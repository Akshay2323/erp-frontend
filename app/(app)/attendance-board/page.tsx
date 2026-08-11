"use client";

import { Suspense } from "react";

import { AttendanceBoard } from "@/components/attendance-board/AttendanceBoard";

export default function AttendanceBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Loading attendance board…
        </div>
      }
    >
      <AttendanceBoard />
    </Suspense>
  );
}
