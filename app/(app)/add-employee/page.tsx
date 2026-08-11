"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EmployeeAddWizard } from "@/components/employee/add-wizard/EmployeeAddWizard";
import { getEmployeeDetail } from "@/lib/api/employee";
import { useAuthToken } from "@/lib/use-auth-token";

export default function AddEmployeePage() {
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const editIdParam = searchParams.get("edit");
  const editEmployeeId = useMemo(() => {
    const n = Number(editIdParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [editIdParam]);

  const employeeQuery = useQuery({
    queryKey: ["employee-detail", editEmployeeId, token],
    queryFn: () => getEmployeeDetail(token, editEmployeeId as number),
    enabled: Boolean(token) && Boolean(editEmployeeId),
  });

  return (
    <EmployeeAddWizard
      editEmployeeId={editEmployeeId}
      initialData={
        (employeeQuery.data?.data as any)?.employee || employeeQuery.data?.data || null
      }
      isLoading={editEmployeeId ? employeeQuery.isLoading : false}
    />
  );
}
