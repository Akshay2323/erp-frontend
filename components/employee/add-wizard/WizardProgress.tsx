import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type WizardProgressProps = {
  currentIndex: number;
  total: number;
  labels: readonly string[];
  allowJumping?: boolean;
  onStepClick?: (index: number) => void;
};

export function WizardProgress({
  currentIndex,
  total,
  labels,
  allowJumping = false,
  onStepClick,
}: WizardProgressProps) {
  const pct = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Step {currentIndex + 1} of {total}
          <span className="text-muted-foreground">
            {" "}
            — {labels[currentIndex] ?? ""}
          </span>
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div
        aria-hidden="true"
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-all duration-300 ease-out",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="flex gap-1.5 text-[11px] text-muted-foreground overflow-x-auto whitespace-nowrap py-1 scrollbar-none">
        {labels.map((label, i) => {
          const isActive = i === currentIndex;
          const isCompleted = i < currentIndex;
          return (
            <li
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-all select-none",
                isActive && "bg-primary text-primary-foreground font-semibold shadow-sm",
                !isActive && allowJumping && "cursor-pointer hover:bg-muted hover:text-foreground",
                !isActive && !allowJumping && "opacity-80",
                isCompleted && !isActive && "text-foreground/80",
              )}
              key={label}
              onClick={() => {
                if (allowJumping && onStepClick) {
                  onStepClick(i);
                }
              }}
            >
              {isCompleted ? <Check className="h-3 w-3" /> : null}
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
