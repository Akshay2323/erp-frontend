"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthToken } from "@/lib/use-auth-token";
import { Calendar, Filter, Search, RefreshCw, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPaymentHistory } from "@/lib/api/payroll";

const avatarColors = [
  "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
  "bg-sky-500 text-white dark:bg-sky-600 dark:text-white",
] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PaymentRow = Record<string, unknown>;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "UN";
}

function formatAmount(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `₹ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentHistoryPage() {
  const token = useAuthToken();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getPaymentHistory(token, {
        month,
        year,
        per_page: 100,
        q: searchQuery.trim() || undefined,
      });
      setPayments(res.data ?? []);
    } catch (err) {
      console.error("Failed to fetch payment history:", err);
      toast.error(err instanceof Error ? err.message : "Unable to load payment history.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [month, year, searchQuery, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPayments();
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPayments, searchQuery]);

  const grandTotal = useMemo(() => {
    return payments.reduce((sum, p) => {
      const amount = Number(p.amount_paid ?? p.amount ?? p.paid_amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [payments]);

  const resetFilters = () => {
    const d = new Date();
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Payment History</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4 pt-5">
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/50 p-1.5 px-3 text-sm font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-medium text-primary"
                onClick={resetFilters}
              >
                Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-2">
                <Label className="text-xs font-normal text-muted-foreground">Payroll Month</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {MONTHS.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {label} {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-normal text-muted-foreground">Payroll Year</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={year}
                    min={2020}
                    max={2100}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="pr-10"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-9">
          <Card className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search Staff"
                    className="h-9 pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-9 border-primary/30 px-4 font-medium text-primary hover:bg-primary/10"
                  onClick={() => void fetchPayments()}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button className="h-9 bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-foreground">
                  Showing {payments.length} staff
                </span>
                <span className="text-border">|</span>
                <Button
                  variant="link"
                  className="h-auto p-0 font-medium text-primary"
                  onClick={resetFilters}
                >
                  Reset Filters
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto bg-card">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="min-w-[200px] p-4">Name</th>
                      <th className="p-4">Payment Date</th>
                      <th className="p-4">Payment Type</th>
                      <th className="p-4">Amount Paid</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4">UTR No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No payment records found for {MONTHS[month - 1]} {year}.
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment, index) => {
                        const name = String(
                          payment.full_name ?? payment.employee_name ?? payment.name ?? "Unknown",
                        );
                        return (
                          <tr key={String(payment.id ?? index)} className="transition-colors hover:bg-muted/50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[index % avatarColors.length]}`}
                                >
                                  {initials(name)}
                                </div>
                                <span className="text-[13px] font-medium text-foreground">{name}</span>
                              </div>
                            </td>
                            <td className="p-4 font-medium text-muted-foreground">
                              {String(payment.payment_date ?? payment.paid_at ?? payment.date ?? "-")}
                            </td>
                            <td className="p-4 font-medium text-muted-foreground">
                              {String(payment.payment_type ?? payment.type ?? "Salary")}
                            </td>
                            <td className="p-4 font-medium text-foreground">
                              {formatAmount(payment.amount_paid ?? payment.amount ?? payment.paid_amount)}
                            </td>
                            <td className="p-4 font-medium text-muted-foreground">
                              {String(payment.status ?? "-")}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {String(payment.transaction_id ?? payment.transactionId ?? "-")}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {String(payment.utr_no ?? payment.utr ?? "-")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {payments.length > 0 && (
                      <tr className="border-t-2 border-border/50 bg-muted/40 font-semibold text-foreground">
                        <td className="p-4" colSpan={3}>
                          Grand Totals
                        </td>
                        <td className="p-4">{formatAmount(grandTotal)}</td>
                        <td className="p-4" colSpan={3} />
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
