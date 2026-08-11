"use client";

import { ChevronDown, UserRound, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeWizardValues } from "@/lib/validations/employee-wizard";
import { cn } from "@/lib/utils";

type ManagerHit = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
};

function formatManagerLabel(m: ManagerHit): string {
  const name = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return name || m.email || `Employee #${m.id}`;
}

type ManagerComboboxProps = {
  token: string;
  companyId?: number;
  branchId?: number;
  excludeEmployeeId?: number;
  disabled?: boolean;
  fetchManagers: (
    token: string,
    params: { company_id?: number; branch_id?: number; q: string },
  ) => Promise<ManagerHit[]>;
};

export function ManagerCombobox({
  token,
  companyId,
  branchId,
  excludeEmployeeId,
  disabled,
  fetchManagers,
}: ManagerComboboxProps) {
  const { watch, setValue } = useFormContext<EmployeeWizardValues>();
  const managerLabel = watch("reporting_manager_label") ?? "";
  const managerId = watch("reporting_manager_id");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [hits, setHits] = useState<ManagerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!token || !open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const list = await fetchManagers(token, {
          company_id: companyId,
          branch_id: branchId,
          q: deferredQuery.trim() || " ",
        });
        const filtered = excludeEmployeeId
          ? list.filter((item) => item.id !== excludeEmployeeId)
          : list;
        if (!cancelled) setHits(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, companyId, branchId, excludeEmployeeId, deferredQuery, open, fetchManagers]);

  const displayValue = open ? query : managerLabel;

  return (
    <div className="relative space-y-1.5" ref={rootRef}>
      <Label htmlFor="reporting-manager-search">Reporting manager</Label>
      <div className="relative">
        <Input
          aria-autocomplete="list"
          aria-expanded={open}
          autoComplete="off"
          className="pr-20"
          disabled={disabled}
          id="reporting-manager-search"
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (!v.trim()) {
              setValue("reporting_manager_id", undefined);
              setValue("reporting_manager_label", "");
            }
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(managerLabel);
          }}
          placeholder="Search by name or email..."
          role="combobox"
          value={displayValue}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
          {managerId ? (
            <Button
              aria-label="Clear manager"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                setValue("reporting_manager_id", undefined);
                setValue("reporting_manager_label", "");
                setQuery("");
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            aria-label="Toggle suggestions"
            className="h-8 w-8 shrink-0"
            onClick={() => setOpen((o) => !o)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </div>
      </div>
      {open ? (
        <ul
          className={cn(
            "absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-popover p-1 text-sm shadow-md",
          )}
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">
              No matches. Keep typing to search.
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setValue("reporting_manager_id", h.id);
                    setValue("reporting_manager_label", formatManagerLabel(h));
                    setQuery("");
                    setOpen(false);
                  }}
                  type="button"
                >
                  <UserRound className="h-4 w-4 shrink-0 opacity-70" />
                  <span>{formatManagerLabel(h)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Optional. Search existing employees in this company.
      </p>
    </div>
  );
}
