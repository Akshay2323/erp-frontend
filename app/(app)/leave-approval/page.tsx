"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Search, X, XCircle } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatEmployeeName,
  LeaveRequestDateRange,
  LeaveStatusBadge,
} from "@/components/leave/leave-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isLeaveApproverSession, readAuthUser } from "@/lib/auth-session";
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
import { useRouter } from "next/navigation";

const PER_PAGE = 10;

export default function LeaveApprovalPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const [canApprove, setCanApprove] = useState(false);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    const user = readAuthUser();
    const allowed = isLeaveApproverSession(user);
    setCanApprove(allowed);
    if (!allowed) router.replace("/leave-requests");
  }, [router]);

  const requestsQuery = useQuery({
    queryKey: ["leave-approval", token, page, PER_PAGE, statusFilter],
    queryFn: async () => {
      const response = await getLeaveRequests(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
      });
      return normalizeLeaveRequestList(response);
    },
    enabled: Boolean(token) && canApprove,
  });

  const { items: requests, pagination } = requestsQuery.data ?? {
    items: [],
    pagination: { current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0, from: null, to: null },
  };

  const filteredRequests = deferredSearch.trim()
    ? requests.filter((r) => {
        const q = deferredSearch.trim().toLowerCase();
        const name = formatEmployeeName(r.employee).toLowerCase();
        const type = (r.leave_type?.name ?? "").toLowerCase();
        const reason = (r.reason ?? "").toLowerCase();
        return name.includes(q) || type.includes(q) || reason.includes(q) || String(r.id).includes(q);
      })
    : requests;

  const isLoading = requestsQuery.isLoading || requestsQuery.isFetching;

  const handleApprove = async (request: LeaveRequest) => {
    if (!token) return;
    setActionId(request.id);
    try {
      const response = await approveLeaveRequest(token, request.id);
      toast.success(response.message || "Leave request approved.");
      await queryClient.invalidateQueries({ queryKey: ["leave-approval"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to approve leave request.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    if (!token || !rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    setRejecting(true);
    try {
      const response = await rejectLeaveRequest(token, rejectTarget.id, {
        rejected_reason: rejectReason.trim(),
      });
      toast.success(response.message || "Leave request rejected.");
      setRejectTarget(null);
      setRejectReason("");
      await queryClient.invalidateQueries({ queryKey: ["leave-approval"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to reject leave request.");
    } finally {
      setRejecting(false);
    }
  };

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
      await queryClient.invalidateQueries({ queryKey: ["leave-approval"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to cancel leave request.");
    } finally {
      setCancelling(false);
    }
  };

  if (!canApprove) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        Loading…
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Leave Approval</h1>
            <p className="text-sm text-muted-foreground">
              Review, approve, reject, or cancel employee leave requests.
            </p>
          </div>
        </div>
      </div>

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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Leave type</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>
                    Loading leave requests…
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => {
                  const isPending = request.status.toLowerCase() === "pending";
                  const busy = actionId === request.id;

                  return (
                    <tr key={request.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-3 py-3 font-medium">#{request.id}</td>
                      <td className="px-3 py-3">{formatEmployeeName(request.employee)}</td>
                      <td className="px-3 py-3">{request.leave_type?.name ?? "-"}</td>
                      <td className="px-3 py-3">
                        <LeaveRequestDateRange request={request} />
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3" title={request.reason}>
                        {request.reason}
                      </td>
                      <td className="px-3 py-3">
                        <LeaveStatusBadge status={request.status} />
                        {request.rejection_reason ? (
                          <p className="mt-1 text-xs text-muted-foreground" title={request.rejection_reason}>
                            {request.rejection_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <Button
                                disabled={busy}
                                onClick={() => handleApprove(request)}
                                size="sm"
                                variant="default"
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                {busy ? "…" : "Approve"}
                              </Button>
                              <Button
                                onClick={() => {
                                  setRejectTarget(request);
                                  setRejectReason("");
                                }}
                                size="sm"
                                variant="outline"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {request.status.toLowerCase() !== "cancelled" &&
                          request.status.toLowerCase() !== "rejected" ? (
                            <Button
                              onClick={() => {
                                setCancelTarget(request);
                                setCancelReason("");
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Reject leave request</h2>
                <p className="text-sm text-muted-foreground">
                  {formatEmployeeName(rejectTarget.employee)} — {rejectTarget.leave_type?.name}
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
              Rejection reason *
            </label>
            <Textarea
              id="reject_reason"
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this request is rejected"
              rows={3}
              value={rejectReason}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setRejectTarget(null)} variant="outline">
                Close
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={rejecting}
                onClick={handleReject}
              >
                {rejecting ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cancel leave request</h2>
                <p className="text-sm text-muted-foreground">
                  {formatEmployeeName(cancelTarget.employee)} — {cancelTarget.leave_type?.name}
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
            <label className="mb-1 block text-sm font-medium" htmlFor="cancel_reason_admin">
              Reason (optional)
            </label>
            <Textarea
              id="cancel_reason_admin"
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional note for cancellation"
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
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
