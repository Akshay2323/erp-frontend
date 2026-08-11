"use client";

import { Check, Palette } from "lucide-react";

import { useAccentTheme } from "@/components/accent-theme-provider";
import { cn } from "@/lib/utils";
import type { AccentThemeId } from "@/lib/accent-theme";
import { toast } from "sonner";

type AccentThemePickerProps = {
  className?: string;
  /** Compact glassmorphic chip for profile banners */
  variant?: "banner" | "panel";
};

export function AccentThemePicker({
  className,
  variant = "banner",
}: AccentThemePickerProps) {
  const { accentId, themes, setAccentId, theme } = useAccentTheme();

  const onPick = (id: AccentThemeId) => {
    if (id === accentId) return;
    setAccentId(id);
    toast.success(`Theme color set to ${themes.find((t) => t.id === id)?.name ?? id}`);
  };

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 backdrop-blur-md",
          className,
        )}
      >
        <Palette className="h-3.5 w-3.5 shrink-0 text-white/80" />
        <div className="flex flex-wrap gap-1.5">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.name}
              aria-label={`Use ${t.name} theme`}
              aria-pressed={accentId === t.id}
              onClick={() => onPick(t.id)}
              className={cn(
                "h-4 w-4 cursor-pointer rounded-full border border-white/25 transition-all hover:scale-125",
                t.colorCircle,
                accentId === t.id && "scale-110 ring-2 ring-white",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Theme color</p>
          <p className="text-xs text-muted-foreground">
            Applies across the whole app — buttons, active menu links, and accents.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {themes.map((t) => {
          const selected = accentId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-all",
                selected
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  t.colorCircle,
                )}
              >
                {selected ? <Check className="h-3 w-3 text-white" /> : null}
              </span>
              <span className="truncate">{t.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Current: <span className="font-medium text-foreground">{theme.name}</span>
      </p>
    </div>
  );
}
