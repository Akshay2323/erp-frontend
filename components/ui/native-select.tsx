import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native &lt;select&gt; with suppressHydrationWarning — avoids console noise when
 * browser extensions (autofill) inject attributes like fdprocessedid before hydrate.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={className}
      suppressHydrationWarning
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";

/** Default styling matching filter bars across list pages. */
const filterSelectClassName =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm text-foreground";

const NativeSelectFilter = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <NativeSelect ref={ref} className={cn(filterSelectClassName, className)} {...props} />
));
NativeSelectFilter.displayName = "NativeSelectFilter";

export { NativeSelect, NativeSelectFilter, filterSelectClassName };
