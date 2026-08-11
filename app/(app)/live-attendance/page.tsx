"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Clock,
  Play,
  Pause,
  Table as TableIcon,
  Grid as GridIcon,
  Search,
  Calendar,
  MapPin,
  User,
  Building2,
  Sparkles,
  Wifi,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Maximize2,
  X,
  Map as MapIcon,
  Laptop,
  Smartphone,
  Eye,
  Smile,
  ShieldAlert,
} from "lucide-react";

import { useAuthToken } from "@/lib/use-auth-token";
import {
  canViewLiveAttendanceSession,
  isEmployeeSession,
  readAuthUser,
} from "@/lib/auth-session";
import {
  fetchLiveAttendanceFeedAll,
  fetchLiveAttendanceFeedStats,
  LiveAttendanceFeedError,
  pollLiveAttendanceFeed,
  type LiveAttendanceFeedStats,
} from "@/lib/api/live-attendance-feed";
import {
  mapLiveFeedItemToEvent,
  maxLogId,
  mergeFeedEvents,
  type AttendanceEvent,
} from "@/lib/live-attendance/feed-mapper";
import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 3000;

// Dynamically import Leaflet map with SSR disabled to prevent server-side errors
const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <div className="text-center space-y-2">
        <MapIcon className="h-8 w-8 animate-bounce text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Loading interactive map...</p>
      </div>
    </div>
  ),
});

const getTodayDateString = () => new Date().toISOString().split("T")[0];

export default function LiveAttendancePage() {
  const router = useRouter();
  const token = useAuthToken();

  useEffect(() => {
    const user = readAuthUser();
    if (isEmployeeSession(user) || !canViewLiveAttendanceSession(user)) {
      router.replace("/employee-dashboard");
    }
  }, [router]);

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [feedStats, setFeedStats] = useState<LiveAttendanceFeedStats | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "in" | "out" | "flagged">("all");
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [selectedSelfieEvent, setSelectedSelfieEvent] = useState<AttendanceEvent | null>(null);
  const [selectedMapEvent, setSelectedMapEvent] = useState<AttendanceEvent | null>(null);

  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef = useRef(0);
  const pollTickRef = useRef(0);
  const isToday = selectedDate === getTodayDateString();
  const isWaitingForToken = !token;
  const showFeedLoader = isWaitingForToken || isLoadingFeed;

  const loadFeedForDate = async (date: string, search?: string) => {
    if (!token) return;
    setIsLoadingFeed(true);
    setFeedError(null);
    setAccessDenied(false);

    try {
      const [list, stats] = await Promise.all([
        fetchLiveAttendanceFeedAll(token, { date, search: search?.trim() || undefined }),
        fetchLiveAttendanceFeedStats(token, date),
      ]);

      const mapped = list.items.map(mapLiveFeedItemToEvent);
      setEvents(mapped);
      setFeedStats(stats);
      lastIdRef.current = maxLogId(mapped);
      setHasLoadedOnce(true);
    } catch (error) {
      if (error instanceof LiveAttendanceFeedError && error.status === 403) {
        setAccessDenied(true);
        setFeedError("You are not allowed to view the live attendance feed.");
      } else {
        setFeedError(
          error instanceof Error ? error.message : "Failed to load live attendance feed.",
        );
      }
      setEvents([]);
      setFeedStats(null);
      lastIdRef.current = 0;
      setHasLoadedOnce(true);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadFeedForDate(selectedDate, searchQuery);
    if (selectedDate !== getTodayDateString()) {
      setIsLiveActive(false);
    } else {
      setIsLiveActive(true);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    if (!token || accessDenied) return;

    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
    }

    if (!isLiveActive || !isToday) return;

    liveIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          const poll = await pollLiveAttendanceFeed(token, {
            date: selectedDate,
            since_id: lastIdRef.current,
          });

          if (poll.items.length > 0) {
            const incoming = poll.items.map(mapLiveFeedItemToEvent);
            setEvents((prev) => mergeFeedEvents(prev, incoming));
            lastIdRef.current = Math.max(lastIdRef.current, poll.last_id);

            const latest = incoming[incoming.length - 1];
            if (latest.status === "flagged") {
              toast.warning(`${latest.name} punched outside geofence`, {
                description: `${latest.type} at ${latest.time} • ${latest.punchLocationLabel}`,
                icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
              });
            } else {
              toast.success(`${latest.name} recorded ${latest.type}`, {
                description: `${latest.punchLocationLabel} at ${latest.time}`,
                icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
              });
            }
          }

          pollTickRef.current += 1;
          if (pollTickRef.current % 10 === 0) {
            const stats = await fetchLiveAttendanceFeedStats(token, selectedDate);
            setFeedStats(stats);
          }
        } catch (error) {
          if (error instanceof LiveAttendanceFeedError && error.status === 403) {
            setAccessDenied(true);
            setIsLiveActive(false);
            return;
          }
          console.warn("Live attendance poll failed:", error);
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [isLiveActive, isToday, selectedDate, token, accessDenied]);

  const stats = useMemo(() => {
    if (feedStats) {
      return {
        total: feedStats.total_live_actions,
        ins: feedStats.punched_in,
        outs: feedStats.punched_out,
        flagged: events.filter((e) => e.status === "flagged").length,
        geofenceCompliance: feedStats.geofence_compliance_percent,
      };
    }

    const total = events.length;
    const ins = events.filter((e) => e.type === "Punch In").length;
    const outs = events.filter((e) => e.type === "Punch Out").length;
    const flagged = events.filter((e) => e.status === "flagged").length;
    const inside = events.filter((e) => e.status === "verified").length;
    const geofenceCompliance = total > 0 ? Math.round((inside / total) * 1000) / 10 : 0;

    return { total, ins, outs, flagged, geofenceCompliance };
  }, [events, feedStats]);

  // Filtered List
  const filteredEvents = useMemo(() => {
    return events
      .filter((e) => {
        // Tab check
        if (activeTab === "in") return e.type === "Punch In";
        if (activeTab === "out") return e.type === "Punch Out";
        if (activeTab === "flagged") return e.status === "flagged";
        return true;
      })
      .filter((e) => {
        // Search query
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          e.name.toLowerCase().includes(query) ||
          e.employeeCode.toLowerCase().includes(query) ||
          e.department.toLowerCase().includes(query) ||
          e.punchLocationLabel.toLowerCase().includes(query) ||
          e.geofenceSiteLabel.toLowerCase().includes(query) ||
          e.locationName.toLowerCase().includes(query)
        );
      });
  }, [events, activeTab, searchQuery]);

  return (
    <section className="space-y-6 select-none animate-in fade-in duration-500">
      {accessDenied ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <ShieldAlert className="h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-semibold">Live attendance access restricted</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            This page is available only for admin and HR users with attendance feed permission.
          </p>
        </div>
      ) : (
        <>
      {/* Dynamic Status / Header Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6 shadow-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-6 w-6" />
              {isLiveActive && isToday && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Live Attendance Feed</h1>
                {isToday ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isLiveActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                    <Wifi className={`h-3 w-3 ${isLiveActive ? "animate-pulse" : ""}`} />
                    {isLiveActive ? "LIVE FEED RUNNING" : "FEED PAUSED"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-500">
                    <Calendar className="h-3 w-3" />
                    HISTORICAL DATA
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Monitor employee punch in/out in real time from the live API feed (polls every 3 seconds).
              </p>
            </div>
          </div>

          {/* Core Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Play / Pause for Feed */}
            {isToday && (
              <Button
                variant={isLiveActive ? "outline" : "default"}
                onClick={() => setIsLiveActive((prev) => !prev)}
                className={`h-10 rounded-xl px-4 gap-2 transition-all ${
                  isLiveActive
                    ? "bg-rose-50/85 hover:bg-rose-100/85 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 border-rose-500/20"
                    : ""
                }`}
              >
                {isLiveActive ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" /> Pause Live Feed
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" /> Start Live Feed
                  </>
                )}
              </Button>
            )}

            {/* Date Selection */}
            <div className="relative flex items-center rounded-xl border border-border bg-background px-3 py-2 h-10 shadow-xs focus-within:ring-2 focus-within:ring-primary/20">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                max={getTodayDateString()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none border-none text-foreground cursor-pointer"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-border bg-background p-1 h-10 shadow-xs">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center justify-center px-3 rounded-lg text-sm font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center px-3 rounded-lg text-sm font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid Feed View"
              >
                <GridIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row with Premium Glassmorphism styling */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Total punches */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/5 blur-xl"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Logs</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <TableIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total punches received today</p>
        </div>

        {/* Punch Ins - Emerald Glowing Theme */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-50/5 dark:bg-emerald-950/5 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/10 blur-xl"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Punch Ins</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.ins}</p>
          <p className="text-xs text-muted-foreground mt-1">Employees check-ins today</p>
        </div>

        {/* Punch Outs - Orange-Red / Rose Glowing Theme */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-50/5 dark:bg-rose-950/5 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-rose-500/10 blur-xl"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Punch Outs</span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <Wifi className="h-4 w-4 rotate-180" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">{stats.outs}</p>
          <p className="text-xs text-muted-foreground mt-1">Employees check-outs today</p>
        </div>

        {/* Active Geofences */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-indigo-500/5 blur-xl"></div>
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geofence OK</span>
            <div className="rounded-lg bg-indigo-50/10 dark:bg-indigo-950/20 p-2 text-indigo-500">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{stats.geofenceCompliance}%</p>
          <p className="text-xs text-muted-foreground mt-1">Punches inside authorized geofence</p>
        </div>
      </div>

      {/* Control Bar: Tabs, Search, and Status Info */}
      {feedError && !accessDenied ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {feedError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-border bg-card p-4 rounded-2xl shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
          {[
            { id: "all", label: "All Events" },
            { id: "in", label: "Punch Ins" },
            { id: "out", label: "Punch Outs" },
            { id: "flagged", label: "Flagged Checkups" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.id === "flagged" && stats.flagged > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white animate-pulse">
                  {stats.flagged}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter Input */}
        <div className="relative w-full sm:w-80 shadow-inner">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee, code, branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-background outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Results Workspace */}
      <AnimatePresence mode="popLayout">
        {showFeedLoader ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 rounded-2xl border border-border bg-muted/15">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-foreground">
              {isWaitingForToken ? "Connecting to live feed…" : "Loading live attendance feed…"}
            </p>
            <p className="text-xs text-muted-foreground">Please wait while punch records are fetched.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-3 py-20 rounded-2xl border border-dashed border-border bg-muted/15"
          >
            <div className="rounded-full bg-muted p-4">
              <Search className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-base font-semibold">No attendance entries found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs mt-0.5">
              {hasLoadedOnce
                ? "No punch records for this date match your search or filters. Try another date or clear the search."
                : "No punch records are available yet."}
            </p>
          </motion.div>
        ) : viewMode === "table" ? (
          /* Table View - Highly responsive and animated */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Punch Event</th>
                    <th className="px-5 py-3.5">Time Log</th>
                    <th className="px-5 py-3.5">Verified Location</th>
                    <th className="px-5 py-3.5">Selfie Validation</th>
                    <th className="px-5 py-3.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {filteredEvents.map((row) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="transition-colors hover:bg-muted/30"
                      >
                        {/* Employee details */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <FeedEmployeeAvatar
                              className="h-9 w-9"
                              name={row.name}
                              src={row.avatarUrl || undefined}
                              textClassName="text-xs"
                            />
                            <div>
                              <p className="font-semibold text-foreground leading-none">{row.name}</p>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <span>{row.employeeCode}</span>
                                <span>•</span>
                                <span className="bg-muted px-1.5 py-0.2 rounded-md font-medium text-[10px]">{row.department}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Punch In / Out - custom glowing buttons */}
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs ${
                              row.type === "Punch In"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${row.type === "Punch In" ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"}`} />
                            {row.type}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="px-5 py-3 font-semibold text-foreground tracking-tight tabular-nums">
                          {row.time}
                        </td>

                        {/* Location */}
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setSelectedMapEvent(row)}
                            className="flex flex-col text-left group hover:opacity-85 max-w-[220px]"
                          >
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-all flex items-start gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                              <span className="break-all">{row.punchLocationLabel}</span>
                            </span>
                            <span className="text-xs text-muted-foreground mt-1 flex items-start gap-1 pl-5">
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                              <span className="line-clamp-2">{row.geofenceSiteLabel}</span>
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 pl-5">
                              {row.distanceFromCenter <= 50 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Inside Geofence ({row.distanceFromCenter}m)</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">Outside Geofence ({row.distanceFromCenter}m)</span>
                              )}
                            </span>
                          </button>
                        </td>

                        {/* Selfie thumbnail with hover overlay */}
                        <td className="px-5 py-3">
                          {row.selfieUrl ? (
                            <div className="relative group cursor-pointer w-10 h-12 rounded-lg overflow-hidden border border-border shadow-xs hover:border-primary transition-all" onClick={() => setSelectedSelfieEvent(row)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={row.selfieUrl} alt="Selfie Log" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <Maximize2 className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No selfie</span>
                          )}
                        </td>

                        {/* Face Recognition status and actions */}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {row.status === "verified" ? (
                                  <>
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{row.geofenceStatusLabel}</span>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-extrabold">{row.geofenceStatusLabel}</span>
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                  </>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1 select-none">
                                {row.device.includes("iPhone") || row.device.includes("Galaxy") || row.device.includes("Pixel") || row.device.includes("OnePlus") ? (
                                  <Smartphone className="h-2.5 w-2.5" />
                                ) : (
                                  <Laptop className="h-2.5 w-2.5" />
                                )}
                                {row.device}
                              </span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setSelectedSelfieEvent(row)}>
                              <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          /* Grid View - visual security layout */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence initial={false}>
              {filteredEvents.map((row) => (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className={`relative overflow-hidden rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all group ${
                    row.status === "flagged" ? "border-amber-500/20 dark:border-amber-500/10" : "border-border"
                  }`}
                >
                  {/* Glowing header line */}
                  <div className={`h-1.5 w-full ${row.type === "Punch In" ? "bg-emerald-500" : "bg-rose-500"}`} />

                  <div className="p-4 space-y-4">
                    {/* Header Info */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FeedEmployeeAvatar
                          className="h-8 w-8"
                          name={row.name}
                          src={row.avatarUrl || undefined}
                          textClassName="text-[10px]"
                        />
                        <div>
                          <h3 className="text-sm font-bold text-foreground leading-tight">{row.name}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{row.employeeCode} • {row.department}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        row.type === "Punch In" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {row.type}
                      </span>
                    </div>

                    {/* Image comparison layout */}
                    <div className="grid grid-cols-2 gap-2 h-36">
                      <div className="relative rounded-lg overflow-hidden border border-border/60">
                        <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white z-10 select-none">
                          OFFICIAL PHOTO
                        </div>
                        <FeedEmployeeAvatar
                          className="h-full w-full rounded-lg"
                          name={row.name}
                          src={row.profilePicUrl || undefined}
                          textClassName="text-lg"
                        />
                      </div>
                      <div className="relative rounded-lg overflow-hidden border border-border/60 group cursor-pointer" onClick={() => setSelectedSelfieEvent(row)}>
                        <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white z-10 select-none">
                          PUNCH SELFIE
                        </div>
                        {row.selfieUrl ? (
                          <img src={row.selfieUrl} alt="Selfie taken" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">No selfie</div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <Maximize2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Geolocation & Verification Info */}
                    <div className="bg-muted/30 rounded-xl p-3 text-xs space-y-2 border border-border/40">
                      <div className="flex items-start justify-between gap-2 text-muted-foreground">
                        <span className="flex items-start gap-1 font-semibold text-foreground min-w-0">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                          <span className="break-all">{row.punchLocationLabel}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-foreground shrink-0">{row.time}</span>
                      </div>
                      <p className="flex items-start gap-1 text-[11px] text-muted-foreground pl-5">
                        <Building2 className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{row.geofenceSiteLabel}</span>
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px]">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {row.distanceFromCenter <= 50 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified Geofence ({row.distanceFromCenter}m)</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">Outside Geofence ({row.distanceFromCenter}m)</span>
                          )}
                        </span>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${
                          row.status === "verified" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        }`}>
                          {row.geofenceStatusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 h-8.5 rounded-lg" onClick={() => setSelectedMapEvent(row)}>
                        <MapIcon className="h-3.5 w-3.5" />
                        Show GPS Map
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8.5 w-8.5 rounded-lg border border-border" onClick={() => setSelectedSelfieEvent(row)}>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie Comparison Modal */}
      <AnimatePresence>
        {selectedSelfieEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSelfieEvent(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-card rounded-2xl border border-border p-6 shadow-2xl overflow-hidden z-10"
            >
              <button
                onClick={() => setSelectedSelfieEvent(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
                <Smile className="h-5 w-5 text-primary" />
                Punch Selfie Audit
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Compare the employee profile photo with the selfie captured at punch time.
              </p>

              {/* Side-by-side View */}
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                {/* Official Avatar */}
                <div className="flex flex-col items-center p-4 border border-border rounded-xl bg-muted/20 relative">
                  <span className="absolute top-2 left-2 bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                    OFFICIAL ID
                  </span>
                  <div className="mt-3 h-44 w-44 overflow-hidden rounded-xl border border-border/80 shadow-sm">
                    <FeedEmployeeAvatar
                      className="h-full w-full rounded-xl"
                      name={selectedSelfieEvent.name}
                      src={selectedSelfieEvent.profilePicUrl || undefined}
                      textClassName="text-2xl"
                    />
                  </div>
                  <h3 className="font-semibold text-sm mt-4 text-foreground">{selectedSelfieEvent.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedSelfieEvent.employeeCode} • {selectedSelfieEvent.department}</p>
                </div>

                {/* Captured Selfie */}
                <div className="flex flex-col items-center p-4 border border-border rounded-xl bg-muted/20 relative">
                  <span className="absolute top-2 left-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                    PUNCH SELFIE
                  </span>
                  <div className="h-44 w-44 rounded-xl overflow-hidden border border-border/80 shadow-sm mt-3 bg-muted">
                    {selectedSelfieEvent.selfieUrl ? (
                      <img src={selectedSelfieEvent.selfieUrl} alt="Punched Selfie" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">No selfie captured</div>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mt-4 text-foreground flex items-center gap-1.5">
                    {selectedSelfieEvent.geofenceStatusLabel}
                    {selectedSelfieEvent.status === "verified" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Logged via {selectedSelfieEvent.device}</p>
                </div>
              </div>

              {/* Status and Details Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span>Audit Verdict:</span>
                    {selectedSelfieEvent.status === "verified" ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Verified and Approved</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">Flagged for Verification</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Logged at {selectedSelfieEvent.time} • Distance from geofence center: {selectedSelfieEvent.distanceFromCenter}m
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedSelfieEvent(null)} className="rounded-xl h-9.5">
                    Close Details
                  </Button>
                  {selectedSelfieEvent.googleMapsUrl ? (
                    <Button
                      className="rounded-xl h-9.5"
                      onClick={() => window.open(selectedSelfieEvent.googleMapsUrl!, "_blank")}
                    >
                      Open in Google Maps
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Geolocation Map Modal */}
      <AnimatePresence>
        {selectedMapEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMapEvent(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-card rounded-2xl border border-border p-6 shadow-2xl overflow-hidden z-10"
            >
              <button
                onClick={() => setSelectedMapEvent(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-all z-20"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
                <MapIcon className="h-5 w-5 text-primary" />
                Punch Location coordinates
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Employee {selectedMapEvent.name} punched from the GPS coordinates shown on the map below.
              </p>

              {/* Map Holder */}
              <div className="h-[350px] w-full rounded-xl overflow-hidden border border-border shadow-inner mb-4 relative z-0">
                <LiveMap
                  lat={selectedMapEvent.latitude}
                  lng={selectedMapEvent.longitude}
                  employeeName={selectedMapEvent.name}
                  locationName={selectedMapEvent.punchLocationLabel}
                  radius={60}
                />
              </div>

              {/* Details and Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground text-center sm:text-left space-y-1">
                  <p className="font-semibold text-foreground text-sm break-all">
                    Punch location: {selectedMapEvent.punchLocationLabel}
                  </p>
                  <p className="line-clamp-2">
                    Office geofence: {selectedMapEvent.geofenceSiteLabel}
                  </p>
                  <p>
                    Coordinates: {selectedMapEvent.latitude.toFixed(6)}, {selectedMapEvent.longitude.toFixed(6)}
                  </p>
                  <p>
                    Geofence Radius deviation: {selectedMapEvent.distanceFromCenter} meters from central terminal
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedMapEvent(null)} className="rounded-xl h-9.5">
                    Close map
                  </Button>
                  <Button
                    onClick={() => {
                      // Open external map in new tab
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${selectedMapEvent.latitude},${selectedMapEvent.longitude}`,
                        "_blank"
                      );
                    }}
                    className="rounded-xl h-9.5 gap-1.5"
                  >
                    Google Maps <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </section>
  );
}
