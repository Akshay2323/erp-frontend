"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Company } from "@/lib/api/company";
import {
  createLeaveType,
  type LeaveApiError,
  type LeaveType,
} from "@/lib/api/leave-policy";
import { buildCreateLeaveTypePayload } from "@/lib/leave-policy-form-utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { TableRowsSkeleton } from "../ui/page-states";

type LeaveTypeManagerProps = {
  token: string;
  companies: Company[];
  leaveTypes: LeaveType[];
  loading: boolean;
  selectedCompanyId: number;
  onCompanyChange: (companyId: number) => void;
  onCreated: () => void;
  onRefresh: () => void;
};

const inputStyles =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function LeaveTypeManager({
  token,
  companies,
  leaveTypes,
  loading,
  selectedCompanyId,
  onCompanyChange,
  onCreated,
  onRefresh,
}: LeaveTypeManagerProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredTypes = selectedCompanyId
    ? leaveTypes.filter((type) => type.company_id === selectedCompanyId)
    : leaveTypes;

  const handleCreate = async () => {
    if (!token) return;
    if (!selectedCompanyId) {
      toast.error("Select a company before creating a leave type.");
      return;
    }
    if (!name.trim()) {
      toast.error("Leave type name is required.");
      return;
    }

    setSaving(true);
    try {
      await createLeaveType(
        token,
        buildCreateLeaveTypePayload(selectedCompanyId, name, code || name),
      );
      toast.success("Leave type created successfully.");
      setName("");
      setCode("");
      onCreated();
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as LeaveApiError).message)
          : "Unable to create leave type.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Leave Types</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create leave types first, then use them in policy rules below. Days per year,
            carry forward, and status are applied automatically. For unpaid leave, add a type
            such as <strong>Unpaid Leave</strong> with code <strong>UL</strong> or <strong>LWP</strong>.
          </p>
        </div>
        <Button onClick={onRefresh} type="button" variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Company</Label>
          <select
            className={inputStyles}
            onChange={(e) => onCompanyChange(Number(e.target.value) || 0)}
            value={selectedCompanyId || 0}
          >
            <option value={0}>Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Type Name</Label>
          <Input
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Privileged Leave"
            value={name}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Code</Label>
          <Input
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. PL"
            value={code}
          />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={saving || !selectedCompanyId}
            onClick={handleCreate}
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Adding..." : "Add Leave Type"}
          </Button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowsSkeleton cols={4} rows={4} />
            ) : filteredTypes.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                  {selectedCompanyId
                    ? "No leave types for this company. Add one above."
                    : "Select a company to view or create leave types."}
                </td>
              </tr>
            ) : (
              filteredTypes.map((type) => (
                <tr className="border-t border-border" key={type.id}>
                  <td className="px-4 py-3 font-medium">{type.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{type.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {companies.find((c) => c.id === type.company_id)?.company_name ??
                      type.company_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {type.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
