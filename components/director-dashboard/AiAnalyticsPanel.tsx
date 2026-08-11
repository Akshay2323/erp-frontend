"use client";

import { ArrowRight, BrainCircuit, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AiInsight, DailyTrendPoint, DepartmentHealthRow } from "@/lib/director-analytics";
import { cn } from "@/lib/utils";

type AiAnalyticsPanelProps = {
  executiveSummary: string;
  healthScore: number;
  insights: AiInsight[];
  trend7d: DailyTrendPoint[];
  departmentHealth: DepartmentHealthRow[];
  loading?: boolean;
};

const severityStyles: Record<AiInsight["severity"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  info: "border-sky-500/30 bg-sky-500/5",
  critical: "border-rose-500/30 bg-rose-500/5",
};

const severityDot: Record<AiInsight["severity"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  critical: "bg-rose-500",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

export function AiAnalyticsPanel({
  executiveSummary,
  healthScore,
  insights,
  trend7d,
  departmentHealth,
  loading,
}: AiAnalyticsPanelProps) {
  const maxRate = Math.max(...trend7d.map((p) => p.presentRate), 1);
  const trendDelta =
    trend7d.length >= 2 ? trend7d[trend7d.length - 1].presentRate - trend7d[0].presentRate : 0;

  return (
    <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-600 dark:text-violet-400">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">AI Executive Analytics</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  Insights from live HR data
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {loading ? "Analyzing workforce signals…" : executiveSummary}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center rounded-2xl border border-border bg-background/80 px-5 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Health score
            </span>
            <span className={cn("text-4xl font-bold", scoreColor(healthScore))}>
              {loading ? "—" : healthScore}
            </span>
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 7-day trend */}
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">7-day attendance trend</h3>
                <p className="text-xs text-muted-foreground">Present rate by day</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                {trendDelta >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                )}
                <span className={trendDelta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {trendDelta >= 0 ? "+" : ""}
                  {trendDelta} pts
                </span>
              </div>
            </div>
            <div className="flex h-36 items-end justify-between gap-2">
              {trend7d.map((point) => (
                <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">{point.presentRate}%</span>
                  <div className="flex w-full items-end justify-center" style={{ height: "88px" }}>
                    <div
                      className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 transition-all"
                      style={{ height: `${Math.max(8, (point.presentRate / maxRate) * 100)}%` }}
                      title={`${point.present} present / ${point.total} records`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department health */}
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <h3 className="text-sm font-semibold">Department health index</h3>
            <p className="mb-3 text-xs text-muted-foreground">AI-scored from attendance + coverage</p>
            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {departmentHealth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No department data available.</p>
              ) : (
                departmentHealth.slice(0, 6).map((row) => (
                  <div key={row.departmentId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate pr-2">{row.name}</span>
                      <span className={cn("font-semibold", scoreColor(row.score))}>{row.score}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          row.score >= 80 ? "bg-emerald-500" : row.score >= 60 ? "bg-amber-500" : "bg-rose-500",
                        )}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {row.presentRate}% present · {row.headcount} staff
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI insight cards */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">AI recommendations</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
              ))
            ) : insights.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                No notable patterns detected. Workforce metrics look stable.
              </p>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn("rounded-xl border p-4", severityStyles[insight.severity])}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot[insight.severity])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{insight.title}</p>
                        {insight.metric ? (
                          <span className="shrink-0 text-xs font-bold text-foreground">{insight.metric}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.message}</p>
                      {insight.actionHref && insight.actionLabel ? (
                        <Link
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-0 text-xs")}
                          href={insight.actionHref}
                        >
                          {insight.actionLabel}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
