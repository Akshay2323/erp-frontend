"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MapPin, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { PageRefreshingBadge, TableRowsSkeleton } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLocations, type GeoLocation } from "@/lib/api/location";
import { getBranches, type Branch } from "@/lib/api/branch";
import { useAuthToken } from "@/lib/use-auth-token";

const statusClass = (active: boolean) => {
  if (active) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
};

export default function LocationListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const token = useAuthToken();

  const locationsQuery = useQuery({
    queryKey: ["locations", token],
    queryFn: () => getLocations(token),
    enabled: Boolean(token),
  });

  const branchesQuery = useQuery({
    queryKey: ["all_branches", token],
    queryFn: () => getBranches(token, { per_page: 500 }),
    enabled: Boolean(token),
  });

  const locations = Array.isArray(locationsQuery.data?.data) ? locationsQuery.data.data : [];
  const branches = Array.isArray(branchesQuery.data?.data) ? branchesQuery.data.data : [];

  const getBranchName = (branchId?: number) => {
    if (!branchId) return "--";
    const b = branches.find((b) => b.id === branchId);
    return b ? b.name : "--";
  };

  const isLoading = isInitialQueryLoad(locationsQuery) || isInitialQueryLoad(branchesQuery);
  const isRefreshing = isQueryRefreshing(locationsQuery) || isQueryRefreshing(branchesQuery);
  const isError = locationsQuery.isError;

  const filteredLocations = locations.filter((loc) => {
    if (statusFilter === "active" && !loc.active) return false;
    if (statusFilter === "inactive" && loc.active) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!loc.code.toLowerCase().includes(q) && !loc.name.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <section className="space-y-5">
      {/* Header & Filters */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Geo Location Management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Define punch-in/out zones (latitude/longitude + radius).
              </p>
            </div>
          </div>
          <Link className={cn(buttonVariants(), "w-full sm:w-auto")} href="/add-location">
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search location code or name..."
              value={searchTerm}
            />
          </div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Location Code</th>
                <th className="px-4 py-3 font-medium">Location Name / Address</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Latitude</th>
                <th className="px-4 py-3 font-medium">Longitude</th>
                <th className="px-4 py-3 font-medium">Radius (m)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableRowsSkeleton cols={8} rows={6} />
              ) : isError ? (
                <tr>
                  <td className="px-4 py-8 text-center text-destructive" colSpan={8}>
                    Failed to load locations. Please try again.
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                    No locations found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr className="transition-colors hover:bg-muted/40" key={loc.id}>
                    <td className="px-4 py-3 font-medium">{loc.code}</td>
                    <td className="px-4 py-3">{loc.name}</td>
                    <td className="px-4 py-3">{loc.branch?.name || getBranchName(loc.branch_id)}</td>
                    <td className="px-4 py-3">{loc.lat}</td>
                    <td className="px-4 py-3">{loc.lng}</td>
                    <td className="px-4 py-3">{loc.radius}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          statusClass(loc.active),
                        )}
                      >
                        {loc.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/edit-location/${loc.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mr-2")}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-muted-foreground animate-pulse">Loading locations...</p>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-destructive">Failed to load locations.</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-muted-foreground">No locations found.</p>
          </div>
        ) : (
          filteredLocations.map((loc) => (
            <div
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
              key={loc.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{loc.name}</h3>
                  <p className="text-sm text-muted-foreground">{loc.code}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                    statusClass(loc.active),
                  )}
                >
                  {loc.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="font-medium">{loc.branch?.name || getBranchName(loc.branch_id)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Latitude</p>
                  <p className="font-medium">{loc.lat}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Longitude</p>
                  <p className="font-medium">{loc.lng}</p>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-muted-foreground">Radius</p>
                  <p className="font-medium">{loc.radius} meters</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-3">
                <Link href={`/edit-location/${loc.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
