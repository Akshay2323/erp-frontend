import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  htmlFor,
  children,
  markRequired,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { markRequired?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      htmlFor={htmlFor}
      {...props}
    >
      {children}
      {markRequired ? (
        <span className="text-destructive" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}
