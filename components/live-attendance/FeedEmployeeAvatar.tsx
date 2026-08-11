"use client";

import { useState } from "react";

import { getEmployeeInitials } from "@/lib/live-attendance/feed-mapper";
import { cn } from "@/lib/utils";

type FeedEmployeeAvatarProps = {
  name: string;
  src?: string;
  className?: string;
  textClassName?: string;
};

export function FeedEmployeeAvatar({
  name,
  src,
  className,
  textClassName,
}: FeedEmployeeAvatarProps) {
  const [failed, setFailed] = useState(!src);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/15 font-bold text-primary",
          className,
        )}
      >
        <span className={cn("select-none", textClassName)}>{getEmployeeInitials(name)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className={cn("rounded-full object-cover border border-border/80", className)}
      src={src}
      onError={() => setFailed(true)}
    />
  );
}
