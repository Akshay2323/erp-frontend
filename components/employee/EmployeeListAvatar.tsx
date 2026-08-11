"use client";

import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { getEmployeeProfilePhotoProxyUrl } from "@/lib/api/employees/http";
import type { EmployeeRecord } from "@/lib/api/employees/types";

export function getEmployeeDisplayName(employee: EmployeeRecord): string {
  const fromParts = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return (
    employee.full_name?.trim() ||
    fromParts ||
    employee.name?.trim() ||
    "Employee"
  );
}

type EmployeeListAvatarProps = {
  employee: EmployeeRecord;
  className?: string;
  textClassName?: string;
};

export function EmployeeListAvatar({
  employee,
  className = "h-9 w-9",
  textClassName = "text-[10px] font-semibold",
}: EmployeeListAvatarProps) {
  const name = getEmployeeDisplayName(employee);
  const src = employee.profile_photo?.download_url
    ? getEmployeeProfilePhotoProxyUrl(employee.id)
    : undefined;

  return (
    <FeedEmployeeAvatar
      className={className}
      name={name}
      src={src}
      textClassName={textClassName}
    />
  );
}
