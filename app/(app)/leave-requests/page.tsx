"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Plus, Search, X, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatEmployeeName,
  LeaveBalancePanel,
  LeaveRequestDateRange,
  LeaveStatusBadge,
} from "@/components/leave/leave-shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  isEmployeeSession,
  readAuthUser,
  resolveEmployeeId,
} from "@/lib/auth-session";
import { resolveEmployeeSession } from "@/lib/api/employee";
import { getLeaveBalances } from "@/lib/api/leave-policy";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  getLeaveRequests,
  normalizeLeaveRequestList,
  rejectLeaveRequest,
  type LeaveRequest,
  type LeaveRequestApiError,
} from "@/lib/api/leave-requests";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const PER_PAGE = 10;

export default function LeaveRequestsPage() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Approve (inline — no modal needed)
  const [approvingId, setApprovingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      const user = readAuthUser();
      const employee = isEmployeeSession(user);
      setIsEmployee(employee);

      let eid = resolveEmployeeId(user);
      if (employee && token && user) {
        try {
          const resolved = await resolveEmployeeSession(token, user);
          if (cancelled) return;
          if (resolved?.employeeId) {
            eid = resolved.employeeId;
            try {
              localStorage.setItem(
                "auth_user",
                JSON.stringify({
                  ...user,
                  employee_id: resolved.employeeId,
                  employee_code: resolved.employeeCode ?? user.employee_code,
                }),
              );
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) setEmployeeId(eid);
    };

    void initSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const requestsQuery = useQuery({
    queryKey: ["leave-requests", token, page, PER_PAGE, statusFilter, isEmployee, employeeId],
    queryFn: async () => {
      const response = await getLeaveRequests(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        ...(isEmployee && employeeId ? { employee_id: employeeId } : {}),
      });
      return normalizeLeaveRequestList(response);
    },
    enabled: Boolean(token) && (!isEmployee || Boolean(employeeId)),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const balancesQuery = useQuery({
    queryKey: ["leave-balances", token, employeeId],
    queryFn: () => getLeaveBalances(token, { employee_id: employeeId! }),
    enabled: Boolean(token) && isEmployee && Boolean(employeeId),
  });

  const { items: requests, pagination } = requestsQuery.data ?? {
    items: [],
    pagination: { current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0, from: null, to: null },
  };

  const balances = (() => {
    const data = balancesQuery.data?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items: unknown }).items)) {
      return (data as { items: unknown[] }).items;
    }
    return [];
  })();

  const filteredRequests = deferredSearch.trim()
    ? requests.filter((r) => {
        const q = deferredSearch.trim().toLowerCase();
        const name = formatEmployeeName(r.employee).toLowerCase();
        const type = (r.leave_name ?? r.leave_type?.name ?? "").toLowerCase();
        const reason = (r.reason ?? "").toLowerCase();
        return name.includes(q) || type.includes(q) || reason.includes(q) || String(r.id).includes(q);
      })
    : requests;

  const isLoading = requestsQuery.isLoading || requestsQuery.isFetching;

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    if (isEmployee) await queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
  };

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async (request: LeaveRequest) => {
    if (!token) return;
    setApprovingId(request.id);
    try {
      const res = await approveLeaveRequest(token, request.id);
      toast.success(res.message || "Leave request approved.");
      await invalidateAll();
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to approve leave request.");
    } finally {
      setApprovingId(null);
    }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!token || !rejectTarget) return;
    setRejecting(true);
    try {
      const res = await rejectLeaveRequest(token, rejectTarget.id, {
        rejected_reason: rejectReason.trim() || "No reason provided",
      });
      toast.success(res.message || "Leave request rejected.");
      setRejectTarget(null);
      setRejectReason("");
      await invalidateAll();
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to reject leave request.");
    } finally {
      setRejecting(false);
    }
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!token || !cancelTarget) return;
    setCancelling(true);
    try {
      const response = await cancelLeaveRequest(token, cancelTarget.id, {
        reason: cancelReason.trim() || undefined,
      });
      toast.success(response.message || "Leave request cancelled.");
      setCancelTarget(null);
      setCancelReason("");
      await invalidateAll();
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to cancel leave request.");
    } finally {
      setCancelling(false);
    }
  };

  const canApproveOrReject = (request: LeaveRequest) =>
    !isEmployee && request.status.toLowerCase() === "pending";

  const canCancel = (request: LeaveRequest) => {
    const status = request.status.toLowerCase();
    return status === "pending" || status === "approved";
  };

  const colSpan = isEmployee ? 7 : 9;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Leave Requests</h1>
              <p className="text-sm text-muted-foreground">
                {isEmployee
                  ? "View your leave requests and remaining balance."
                  : "Manage and review leave requests across the organization."}
              </p>
            </div>
          </div>
          <Link className={cn(buttonVariants())} href="/apply-leave">
            <Plus className="mr-2 h-4 w-4" />
            Apply leave
          </Link>
        </div>
      </div>

      {isEmployee ? <LeaveBalancePanel balances={balances} /> : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by employee, leave type, or reason…"
              value={searchTerm}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            value={statusFilter}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                {!isEmployee ? <th className="px-3 py-2 font-medium">Employee</th> : null}
                <th className="px-3 py-2 font-medium">Leave Type</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={colSpan}>
                    Loading leave requests…
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={colSpan}>
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-3 font-medium text-muted-foreground">#{request.id}</td>
                    {!isEmployee ? (
                      <td className="px-3 py-3 font-medium">{formatEmployeeName(request.employee)}</td>
                    ) : null}
                    <td className="px-3 py-3 font-medium">
                      {request.leave_name || request.leave_type?.name || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        request.leave_category === "unpaid"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      )}>
                        {request.leave_category === "unpaid" ? "Unpaid" : "Paid"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {request.leave_duration === "full_day" ? "Full Day"
                          : request.leave_duration === "half_day" ? "Half Day"
                          : request.leave_duration === "first_half" ? "1st Half"
                          : request.leave_duration === "second_half" ? "2nd Half"
                          : request.leave_duration ?? "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <LeaveRequestDateRange request={request} />
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-muted-foreground" title={request.reason}>
                      {request.reason || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Approve — admin/HR only, pending only */}
                        {canApproveOrReject(request) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
                            disabled={approvingId === request.id}
                            onClick={() => handleApprove(request)}
                          >
                            {approvingId === request.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><Check className="mr-1 h-3.5 w-3.5" />Approve</>
                            )}
                          </Button>
                        )}

                        {/* Reject — admin/HR only, pending only */}
                        {canApproveOrReject(request) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-rose-500/40 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20"
                            onClick={() => {
                              setRejectTarget(request);
                              setRejectReason("");
                            }}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                          </Button>
                        )}

                        {/* Cancel — employee or admin, pending/approved */}
                        {canCancel(request) && !canApproveOrReject(request) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => {
                              setCancelTarget(request);
                              setCancelReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        )}

                        {!canApproveOrReject(request) && !canCancel(request) && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={page >= pagination.last_page || isLoading}
              onClick={() => setPage((p) => p + 1)}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Reject Leave Request</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  #{rejectTarget.id} — {rejectTarget.leave_name || rejectTarget.leave_type?.name}{" "}
                  · {formatEmployeeName(rejectTarget.employee)}
                </p>
              </div>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                onClick={() => setRejectTarget(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-1 block text-sm font-medium" htmlFor="reject_reason">
              Rejection reason <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="reject_reason"
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection…"
              rows={3}
              value={rejectReason}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setRejectTarget(null)} variant="outline">
                Close
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={rejecting}
                onClick={handleReject}
              >
                {rejecting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejecting…</>
                ) : (
                  "Confirm Reject"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Cancel Modal ─────────────────────────────────────────────────── */}
      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cancel Leave Request</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  #{cancelTarget.id} — {cancelTarget.leave_name || cancelTarget.leave_type?.name}
                </p>
              </div>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                onClick={() => setCancelTarget(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-1 block text-sm font-medium" htmlFor="cancel_reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="cancel_reason"
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling this request?"
              rows={3}
              value={cancelReason}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setCancelTarget(null)} variant="outline">
                Close
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</>
                ) : (
                  "Confirm Cancel"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
