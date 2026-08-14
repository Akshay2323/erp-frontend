"use client";

import {
  Activity,
  BriefcaseBusiness,
  Calendar,
  CalendarPlus,
  Clock,
  Coffee,
  Gift,
  HeartHandshake,
  Loader2,
  LogIn,
  LogOut,
  PartyPopper,
  User,
  Users,
  ShieldAlert,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useAuthToken } from "@/lib/use-auth-token";
import { getEmployees, getEmployeeBirthdays, resolveEmployeeSession } from "@/lib/api/employee";
import type { EmployeeBirthdaysResponse } from "@/lib/api/employees/types";
import { punchIn, punchOut, getTodayStatus, formatBreakMinutes } from "@/lib/api/attendance";
import { getLeaveBalances } from "@/lib/api/leave-policy";
import { getHolidays, type Holiday } from "@/lib/api/holiday";
import { normalizeLeaveBalances } from "@/lib/leave-apply-utils";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GeoLocation } from "@/lib/api/location";
import { isWithinAllocatedGeolocation } from "@/lib/geo-fence";
import { loadEmployeeAllocatedGeolocation } from "@/lib/punch-allocated-geo";
import {
  acquireCameraStream,
  acquireFreshPunchPosition,
  attachStreamToVideo,
  getCameraPermissionHelp,
  isMobileDevice,
  type CameraAccessResult,
} from "@/lib/punch-attendance";
import {
  detectPermissionReset,
  getPermanentPermissionHelp,
} from "@/lib/permissions/device-permissions";
import {
  formatPunchAttendanceError,
  formatPunchAttendanceSuccess,
  formatPunchCaptureError,
  formatPunchLocationDeniedMessage,
  formatPunchLocationUnavailableMessage,
  formatPunchOutsideAllocatedGeoMessage,
  formatPunchSignInRequiredMessage,
} from "@/lib/punch-error-messages";
import {
  playPunchSuccessFeedback,
  unlockPunchAudio,
} from "@/lib/punch-success-audio";
import { setHomeDashboardCookie } from "@/lib/auth-cookie";
import { readAuthUser, resolveHomeDashboardPath } from "@/lib/auth-session";
import { useRouter } from "next/navigation";
type FaceApiModule = typeof import("face-api.js");

export default function EmployeeDashboard() {
  const token = useAuthToken();
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [greeting, setGreeting] = useState("Welcome");
  const [teammates, setTeammates] = useState<any[]>([]);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isPunchingOut, setIsPunchingOut] = useState(false);
  const [punchedInTime, setPunchedInTime] = useState<string | null>(null);
  const [punchedOutTime, setPunchedOutTime] = useState<string | null>(null);
  const [punchedInDate, setPunchedInDate] = useState<Date | null>(null);
  const [punchedOutDate, setPunchedOutDate] = useState<Date | null>(null);
  const [liveDuration, setLiveDuration] = useState<string>("00h 00m 00s");
  const [breakCount, setBreakCount] = useState(0);
  const [totalBreakMinutes, setTotalBreakMinutes] = useState(0);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [isLoadingLeaveBalances, setIsLoadingLeaveBalances] = useState(false);
  const [leaveBalancesMessage, setLeaveBalancesMessage] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
  const [birthdays, setBirthdays] = useState<EmployeeBirthdaysResponse["data"] | null>(null);
  const [isLoadingBirthdays, setIsLoadingBirthdays] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isEmployeeRole = userRole?.toLowerCase() === "employee";

  // Selfie Camera States
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraAction, setCameraAction] = useState<"in" | "out" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<
    "" | Extract<CameraAccessResult, { ok: false }>["reason"]
  >("");
  const [cameraErrorDetails, setCameraErrorDetails] = useState<string>("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"loading" | "initializing" | "detected" | "not-detected">("loading");
  const faceDetectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceApiLoaded = useRef(false);
  const faceApiRef = useRef<FaceApiModule | null>(null);
  const allocatedGeoRef = useRef<GeoLocation | null>(null);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const skipFaceCheck = isMobileDevice();

  // Admins / HR who land here (e.g. old home cookie) go to HR Dashboard.
  useEffect(() => {
    const user = readAuthUser();
    if (!user) return;
    setHomeDashboardCookie(user);
    const home = resolveHomeDashboardPath(user);
    if (home !== "/employee-dashboard") {
      router.replace(home);
    }
  }, [router]);

  const parseTimeStr = (timeStr: string) => {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) return d;

    const match = timeStr.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : 0;
      const ampm = match[4]?.toUpperCase();

      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;

      const today = new Date();
      today.setHours(hours, minutes, seconds, 0);
      return today;
    }
    return new Date();
  };

  const format12Hour = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const fetchTodayStatus = async () => {
    try {
      if (!token) return;
      const res = await getTodayStatus(token);
      if (res?.data) {
        const d: any = res.data;
        // API could return times in different formats, look for common keys
        const inTime = d.punch_in_time || d.in_time || d.first_punch || d.punch_in || null;
        const outTime = d.punch_out_time || d.out_time || d.last_punch || d.punch_out || null;

        if (inTime) {
          const d = parseTimeStr(inTime);
          setPunchedInDate(d);
          setPunchedInTime(format12Hour(d));
        } else {
          setPunchedInDate(null);
          setPunchedInTime(null);
        }
        if (outTime) {
          const d = parseTimeStr(outTime);
          setPunchedOutDate(d);
          setPunchedOutTime(format12Hour(d));
        } else {
          setPunchedOutDate(null);
          setPunchedOutTime(null);
        }

        // Determine punched in state
        if (d.punch_status !== undefined) {
          setIsPunchedIn(d.punch_status === "checked_in" || d.punch_status === "in");
        } else if (d.is_punched_in !== undefined) {
          setIsPunchedIn(Boolean(d.is_punched_in));
        } else if (inTime && !outTime) {
          setIsPunchedIn(true);
        } else {
          setIsPunchedIn(false);
        }

        // Extract break count if available
        const breaks =
          d.break_count !== undefined && d.break_count !== null ? Number(d.break_count) :
          d.breaks_count !== undefined && d.breaks_count !== null ? Number(d.breaks_count) :
          d.total_breaks !== undefined && d.total_breaks !== null ? Number(d.total_breaks) :
          d.punches_count !== undefined && d.punches_count !== null ? Math.max(0, Math.floor((Number(d.punches_count) - 1) / 2)) :
          d.punches && Array.isArray(d.punches) ? Math.max(0, Math.floor((d.punches.length - 1) / 2)) :
          0;
        setBreakCount(breaks);

        // Extract total break duration if available
        const breakMins = d.total_break_minutes !== undefined && d.total_break_minutes !== null ? Number(d.total_break_minutes) : 0;
        setTotalBreakMinutes(breakMins);

        console.log("Attendance Status Data:", d, "Calculated breaks:", breaks, "Break minutes:", breakMins);
      }
    } catch (err) {
      console.warn("Failed to fetch today's status", err);
    }
  };

  useEffect(() => {
    // If shift is finished (we have both in and out times)
    if (punchedInDate && punchedOutDate) {
      const diff = Math.max(0, punchedOutDate.getTime() - punchedInDate.getTime());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = hours.toString().padStart(2, "0");
      const mStr = minutes.toString().padStart(2, "0");
      const sStr = seconds.toString().padStart(2, "0");

      setLiveDuration(`${hStr}h ${mStr}m ${sStr}s`);
      return;
    }

    // If shift is ongoing (we have in time, but no out time)
    if (punchedInDate && !punchedOutDate) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.max(0, now.getTime() - punchedInDate.getTime());

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const hStr = hours.toString().padStart(2, "0");
        const mStr = minutes.toString().padStart(2, "0");
        const sStr = seconds.toString().padStart(2, "0");

        setLiveDuration(`${hStr}h ${mStr}m ${sStr}s`);
      }, 1000);

      return () => clearInterval(interval);
    }

    // No shift started yet
    setLiveDuration("00h 00m 00s");
  }, [punchedInDate, punchedOutDate]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    void attachStreamToVideo(stream, videoRef.current).catch((err) => {
      console.warn("Unable to start camera preview", err);
    });
  }, [stream]);

  const submitPunch = async (action: "in" | "out", image: Blob) => {
    if (!token) {
      toast.error(formatPunchSignInRequiredMessage());
      return;
    }

    if (action === "in") setIsPunchingIn(true);
    if (action === "out") setIsPunchingOut(true);
    setIsVerifyingLocation(true);

    const locationToastId = toast.loading(
      action === "in" ? "Getting your location for Punch In…" : "Getting your location for Punch Out…",
    );

    try {
      const position = await acquireFreshPunchPosition();
      toast.dismiss(locationToastId);

      if (!position.ok) {
        if (position.reason === "denied") {
          toast.error(formatPunchLocationDeniedMessage(action), { duration: 10000 });
        } else {
          toast.error(formatPunchLocationUnavailableMessage(action), { duration: 10000 });
        }
        return;
      }

      const coords = position.coords;
      const allocatedGeo = allocatedGeoRef.current;

      if (allocatedGeo) {
        const check = isWithinAllocatedGeolocation(
          coords.latitude,
          coords.longitude,
          allocatedGeo,
        );
        if (!check.within) {
          toast.error(
            formatPunchOutsideAllocatedGeoMessage(action, allocatedGeo.name),
            { duration: 10000 },
          );
          return;
        }
      }

      const apiCall = action === "in" ? punchIn : punchOut;
      const res = await apiCall(token, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        image,
      });
      toast.success(formatPunchAttendanceSuccess(res.message, action));
      playPunchSuccessFeedback(action);
      await fetchTodayStatus();
    } catch (err: unknown) {
      toast.dismiss(locationToastId);
      const message = formatPunchAttendanceError(err, action);
      const punchMayHaveSaved = /was recorded|already punched/i.test(message);
      if (punchMayHaveSaved) {
        await fetchTodayStatus();
      }
      toast.error(message, { duration: 10000 });
    } finally {
      setIsVerifyingLocation(false);
      if (action === "in") setIsPunchingIn(false);
      if (action === "out") setIsPunchingOut(false);
    }
  };

  const openCamera = async (action: "in" | "out") => {
    if (!token) {
      toast.error(formatPunchSignInRequiredMessage());
      return;
    }

    setCameraAction(action);
    setShowCameraModal(true);
    setCameraError("");
    setFaceDetected(false);
    setFaceStatus("initializing");
    if (action === "in") setIsPunchingIn(true);
    if (action === "out") setIsPunchingOut(true);

    // Camera was granted before but the browser is asking again ("Allow this
    // time" / site-data cleanup). Tell the user how to grant permanently.
    void detectPermissionReset("camera").then((reset) => {
      if (reset) {
        toast.info("Tired of camera prompts?", {
          id: "camera-permanent-help",
          description: getPermanentPermissionHelp("camera"),
          duration: 12_000,
        });
      }
    });

    const camera = await acquireCameraStream();
    if (!camera.ok) {
      if (action === "in") setIsPunchingIn(false);
      if (action === "out") setIsPunchingOut(false);
      setCameraError(camera.reason);
      setCameraErrorDetails(camera.details || "");
      setFaceStatus("loading");
      return;
    }

    try {
      setStream(camera.stream);

      if (!faceApiLoaded.current && !skipFaceCheck) {
        setFaceStatus("initializing");
        try {
          if (!faceApiRef.current) {
            faceApiRef.current = await import("face-api.js");
          }
          await faceApiRef.current.nets.tinyFaceDetector.loadFromUri("/models");
          faceApiLoaded.current = true;
        } catch (faceErr) {
          console.warn("Face detection failed to initialize, falling back to standard capture", faceErr);
          toast.warning("Face verification is currently unavailable. Proceeding with standard selfie capture.", {
            id: "face-api-fallback-warning",
          });
          setFaceDetected(true);
          setFaceStatus("detected");
          if (action === "in") setIsPunchingIn(false);
          if (action === "out") setIsPunchingOut(false);
          return;
        }
      }

      const faceapi = faceApiRef.current;
      if (!faceapi || skipFaceCheck) {
        setFaceDetected(true);
        setFaceStatus("detected");
        if (action === "in") setIsPunchingIn(false);
        if (action === "out") setIsPunchingOut(false);
        return;
      }

      setFaceStatus("not-detected");

      const intervalId = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !faceApiRef.current) {
          return;
        }
        try {
          const detection = await faceApiRef.current.detectSingleFace(
            videoRef.current,
            new faceApiRef.current.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5,
            }),
          );
          if (detection) {
            const { width: faceW, height: faceH } = detection.box;
            const videoW = videoRef.current.videoWidth;
            const videoH = videoRef.current.videoHeight;
            const coverage = (faceW * faceH) / (videoW * videoH);
            if (coverage > 0.05) {
              setFaceDetected(true);
              setFaceStatus("detected");
            } else {
              setFaceDetected(false);
              setFaceStatus("not-detected");
            }
          } else {
            setFaceDetected(false);
            setFaceStatus("not-detected");
          }
        } catch {
          // Skip frame on error
        }
      }, 500);

      faceDetectionInterval.current = intervalId;
      if (action === "in") setIsPunchingIn(false);
      if (action === "out") setIsPunchingOut(false);
    } catch (err) {
      console.warn("Camera setup failed", err);
      if (action === "in") setIsPunchingIn(false);
      if (action === "out") setIsPunchingOut(false);
      setCameraError("failed");
      const msg = err instanceof Error ? err.message : String(err || "");
      setCameraErrorDetails(msg || "Exception during camera initialization");
    }
  };

  const closeCamera = () => {
    // Stop face detection loop
    if (faceDetectionInterval.current) {
      clearInterval(faceDetectionInterval.current);
      faceDetectionInterval.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setShowCameraModal(false);
    setCameraAction(null);
    setCameraError("");
    setCameraErrorDetails("");
    setFaceDetected(false);
    setFaceStatus("loading");
    if (cameraAction === "in") setIsPunchingIn(false);
    if (cameraAction === "out") setIsPunchingOut(false);
  };

  const handleCaptureAndPunch = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraAction || isVerifyingLocation) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const action = cameraAction;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error(formatPunchCaptureError());
        return;
      }

      closeCamera();
      await submitPunch(action, blob);
    }, "image/jpeg", 0.92);
  };

  const handlePunchIn = () => {
    unlockPunchAudio();
    void openCamera("in");
  };

  const handlePunchOut = () => {
    unlockPunchAudio();
    void openCamera("out");
  };

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good Morning");
    else if (currentHour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const user = JSON.parse(raw);
        setUserName(user.name || user.first_name || user.username || "User");
        if (user.role) setUserRole(String(user.role));
      }
    } catch {
      // safe fallback
    }

    const fetchTeammates = async () => {
      try {
        if (!token) return;
        const res = await getEmployees(token, { per_page: 5 });
        const items = res.data?.items || res.data || [];
        if (Array.isArray(items)) {
          setTeammates(items.slice(0, 4));
        }
      } catch (err) {
        console.warn("Failed to fetch teammates", err);
      }
    };

    const fetchHolidays = async () => {
      try {
        if (!token) return;
        const todayStr = new Date().toISOString().split("T")[0];
        const res = await getHolidays(token, {
          status: "active",
          holiday_date_from: todayStr,
          per_page: 5,
        });
        const items = Array.isArray(res.data)
          ? res.data
          : res.data && typeof res.data === "object" && "items" in res.data && Array.isArray((res.data as any).items)
          ? (res.data as any).items
          : [];
        setHolidays(items);
      } catch (err) {
        console.warn("Failed to fetch holidays", err);
      } finally {
        setIsLoadingHolidays(false);
      }
    };

    const fetchBirthdays = async () => {
      try {
        if (!token) return;
        const res = await getEmployeeBirthdays(token, 30);
        if (res.data) setBirthdays(res.data);
      } catch (err) {
        console.warn("Failed to fetch birthdays", err);
      } finally {
        setIsLoadingBirthdays(false);
      }
    };

    fetchTeammates();
    fetchTodayStatus();
    fetchHolidays();
    fetchBirthdays();

    const loadAllocatedGeo = async () => {
      try {
        if (!token) return;
        const raw = localStorage.getItem("auth_user");
        const user = raw ? JSON.parse(raw) : null;
        if (!user) return;
        const geo = await loadEmployeeAllocatedGeolocation(token, user);
        allocatedGeoRef.current = geo;
      } catch (err) {
        console.warn("Failed to load allocated geolocation for punch validation", err);
      }
    };

    void loadAllocatedGeo();
  }, [token]);

  useEffect(() => {
    if (!isEmployeeRole) {
      setLeaveBalances([]);
      setLeaveBalancesMessage(null);
      return;
    }

    const fetchBalances = async () => {
      setIsLoadingLeaveBalances(true);
      setLeaveBalancesMessage(null);
      try {
        if (!token) return;

        const raw = localStorage.getItem("auth_user");
        const user = raw ? JSON.parse(raw) : null;
        const resolved = user ? await resolveEmployeeSession(token, user) : null;
        const employeeId = resolved?.employeeId;

        const res = await getLeaveBalances(
          token,
          employeeId ? { employee_id: employeeId } : undefined,
        );
        const items = normalizeLeaveBalances(res.data);
        setLeaveBalances(items);

        if (items.length === 0) {
          setLeaveBalancesMessage(
            "No leave policy assigned or no leave balance found for your profile.",
          );
        }
      } catch (err) {
        console.warn("Failed to fetch leave balances", err);
        setLeaveBalances([]);
        setLeaveBalancesMessage(
          "No leave policy assigned or no leave balance found for your profile.",
        );
      } finally {
        setIsLoadingLeaveBalances(false);
      }
    };

    void fetchBalances();
  }, [isEmployeeRole, token]);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{greeting}, {userName}! 👋</h1>
              <p className="text-sm text-muted-foreground">Here is what is happening today.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6 md:col-span-8">

          {/* Today's Attendance Widget */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-primary" /> Today's Attendance
              </h2>
              <span className="text-sm font-medium text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })}
              </span>
            </div>

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {/* Punch In */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <div className="mb-2 rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <LogIn className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Punch In</p>
                <p className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-100">
                  {punchedInTime || "--:--"}
                </p>
              </div>

              {/* Punch Out */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-rose-50 p-4 dark:bg-rose-900/20">
                <div className="mb-2 rounded-full bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                  <LogOut className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300">Punch Out</p>
                <p className="mt-1 text-xl font-semibold text-rose-950 dark:text-rose-100">
                  {punchedOutTime || "--:--"}
                </p>
              </div>

              {/* Break Time */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                <div className="mb-2 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  <Coffee className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Break Time</p>
                <p className="mt-1 text-xl font-semibold text-amber-950 dark:text-amber-100">
                  {formatBreakMinutes(totalBreakMinutes)}
                </p>
              </div>

              {/* Working Hours */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-primary/5 p-4">
                <div className="mb-2 rounded-full bg-primary/10 p-2 text-primary">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                <p className="mt-1 text-xl font-semibold">{liveDuration}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 w-full">
              {!isPunchedIn ? (
                <Button
                  onClick={handlePunchIn}
                  disabled={isPunchingIn || isVerifyingLocation}
                  className="h-12 rounded-full bg-emerald-600 px-8 text-base font-semibold text-white shadow-md hover:bg-emerald-700 sm:w-auto transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isPunchingIn ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Punching In...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" /> Punch In
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handlePunchOut}
                  disabled={isPunchingOut || isVerifyingLocation}
                  className="h-12 rounded-full bg-rose-500 px-8 text-base font-semibold text-white shadow-md hover:bg-rose-600 sm:w-auto transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isPunchingOut ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Punching Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-5 w-5" /> Punch Out
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {isEmployeeRole ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Calendar className="h-5 w-5 text-indigo-500" /> Leave Balance
                </h2>
                <Link
                  href="/apply-leave"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "h-8 gap-1.5 rounded-lg text-xs shrink-0",
                  )}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Apply Leave
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {isLoadingLeaveBalances ? (
                  <div className="col-span-3 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading leave balances...
                  </div>
                ) : leaveBalances.length > 0 ? (
                  leaveBalances.map((lb, i) => {
                    const name =
                      lb.leave_type?.name ||
                      lb.leave_name ||
                      lb.name ||
                      lb.type ||
                      "Leave";
                    const total = Number(lb.allocated || lb.days_allocated || lb.total || 0);
                    const balance = lb.balance !== undefined ? Number(lb.balance) : Math.max(0, total - Number(lb.used || 0));
                    const pct = total > 0 ? (balance / total) * 100 : 0;

                    const colors = [
                      { bg: "bg-sky-100", text: "text-sky-600", darkBg: "dark:bg-sky-900/40", darkText: "dark:text-sky-400", fill: "bg-sky-500", icon: <Coffee className="h-4 w-4" /> },
                      { bg: "bg-rose-100", text: "text-rose-600", darkBg: "dark:bg-rose-900/40", darkText: "dark:text-rose-400", fill: "bg-rose-500", icon: <Activity className="h-4 w-4" /> },
                      { bg: "bg-amber-100", text: "text-amber-600", darkBg: "dark:bg-amber-900/40", darkText: "dark:text-amber-400", fill: "bg-amber-500", icon: <BriefcaseBusiness className="h-4 w-4" /> },
                    ];
                    const color = colors[i % colors.length];

                    return (
                      <div key={i} className="rounded-xl border border-border p-4 transition-colors hover:bg-muted/40">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-muted-foreground">{name}</p>
                          <div className={`rounded-md ${color.bg} p-1.5 ${color.text} ${color.darkBg} ${color.darkText}`}>
                            {color.icon}
                          </div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{balance.toString().padStart(2, "0")}</span>
                          <span className="text-sm font-medium text-muted-foreground">/ {total.toString().padStart(2, "0")}</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                          <div className={`h-full rounded-full ${color.fill}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {leaveBalancesMessage ??
                        "No leave policy assigned or no leave balance found for your profile."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You can still submit an unpaid leave request if needed.
                    </p>
                    <Link
                      href="/apply-leave"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "mt-4 rounded-lg",
                      )}
                    >
                      <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                      Apply Leave
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6 md:col-span-4">

          {/* Birthdays */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <PartyPopper className="h-5 w-5 text-amber-500" /> Birthdays
            </h2>
            <div className="flex flex-col gap-5 max-h-[400px] overflow-y-auto pr-2">
              {isLoadingBirthdays ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : birthdays?.today?.items?.length || birthdays?.upcoming?.items?.length ? (
                <>
                  {birthdays.today.items.map((emp) => (
                    <div key={emp.id} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{emp.first_name}'s Birthday</p>
                        {(emp.department?.name || emp.designation?.name) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{emp.department?.name || emp.designation?.name}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary animate-pulse">Today</span>
                    </div>
                  ))}
                  {birthdays.upcoming.items.map((emp) => (
                    <div key={emp.id} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{emp.first_name}'s Birthday</p>
                        {(emp.department?.name || emp.designation?.name) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{emp.department?.name || emp.designation?.name}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {new Date(emp.birthday_date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No upcoming birthdays found.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5 text-indigo-500" /> Upcoming Holidays
            </h2>
            <div className="flex flex-col gap-4">
              {isLoadingHolidays ? (
                <div className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> Loading holidays...
                </div>
              ) : holidays.length > 0 ? (
                holidays.map((holiday, i) => {
                  const hDate = new Date(holiday.date);
                  const isToday = hDate.toDateString() === new Date().toDateString();
                  return (
                    <div key={holiday.id || i} className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-center ${
                        isToday 
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                      }`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {hDate.toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-sm font-extrabold leading-none">
                          {hDate.toLocaleDateString("en-US", { day: "2-digit" })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {holiday.name}
                          {isToday && (
                            <span className="inline-flex items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white animate-pulse">
                              Today
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {holiday.type} Holiday {holiday.is_paid && "• Paid"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No upcoming holidays scheduled.
                </div>
              )}
            </div>
          </div>

          {/* Teammates */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-sky-500" /> My Teammates
            </h2>

            <div className="flex flex-col gap-4">
              {teammates.length > 0 ? (
                teammates.map((teammate, i) => (
                  <div key={teammate.id || i} className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border">
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{teammate.first_name} {teammate.last_name}</p>
                      <p className="text-xs text-muted-foreground">{teammate.designation?.name || "Team Member"}</p>
                    </div>
                    {/* Status dot */}
                    <div className={`h-2 w-2 rounded-full ${teammate.is_present === true ? "bg-emerald-500" : "bg-amber-500"}`} title={teammate.is_present === true ? "Online" : "Away"}></div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading teammates...</div>
              )}
            </div>
          </div>

        </div>
      </div>
      {/* Selfie Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-lg animate-in zoom-in-95 duration-200">
            <div className="border-b border-border p-4">
              <h3 className="text-lg font-semibold">
                Capture Selfie to Punch {cameraAction === "in" ? "In" : "Out"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please look at the camera to verify your identity.
              </p>
            </div>
            
            <div className="p-4 flex flex-col items-center gap-3">
              {cameraError ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center w-full">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                    {cameraError === "insecure" ? (
                      <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-500" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                      {cameraError === "insecure"
                        ? "Secure connection required"
                        : cameraError === "denied"
                          ? "Camera access denied"
                          : cameraError === "not-found"
                            ? "Camera not detected"
                            : cameraError === "in-use"
                              ? "Camera already in use"
                              : "Camera initialization failed"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[320px] leading-relaxed">
                      {cameraError === "insecure" ? (
                        "Open this app using HTTPS, then try punch in/out again."
                      ) : cameraError === "denied" ? (
                        "Click the lock icon in the address bar → Site settings → Camera → Allow."
                      ) : cameraError === "not-found" ? (
                        "We couldn't detect any camera hardware. Please plug in a webcam or verify it is enabled in your system settings."
                      ) : cameraError === "in-use" ? (
                        "The webcam is being used by another application (e.g. Zoom, Teams, Skype, or another browser tab). Please close it and try again."
                      ) : (
                        `Unable to initialize your webcam. ${cameraErrorDetails ? `Details: ${cameraErrorDetails}` : ""}`
                      )}
                    </p>
                    {cameraErrorDetails && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Error details: {cameraErrorDetails}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void openCamera(cameraAction === "out" ? "out" : "in")}
                    className="w-full rounded-xl mt-2"
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative w-full aspect-square max-w-[300px] overflow-hidden rounded-full bg-muted flex items-center justify-center"
                    style={{
                      border: `4px solid ${
                        faceStatus === "detected" ? "#22c55e" :
                        faceStatus === "not-detected" ? "#ef4444" :
                        "hsl(var(--primary) / 0.2)"
                      }`,
                      transition: "border-color 0.3s ease"
                    }}
                  >
                    {!stream && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Face detection overlay indicator */}
                    {stream && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-lg ${
                          faceStatus === "detected"
                            ? "bg-green-500 text-white"
                            : faceStatus === "not-detected"
                            ? "bg-red-500 text-white"
                            : "bg-black/50 text-white"
                        }`}>
                          {(faceStatus === "loading" || faceStatus === "initializing") ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              faceStatus === "detected" ? "bg-white animate-pulse" : "bg-white"
                            }`} />
                          )}
                          {faceStatus === "detected" ? "Face detected ✓" :
                           faceStatus === "not-detected" ? "No face detected" :
                           "Loading AI model..."}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Hint message */}
                  {faceStatus === "not-detected" && (
                    <p className="text-xs text-destructive text-center">
                      Please look directly at the camera. Make sure your face is clearly visible and well-lit.
                    </p>
                  )}
                  {(faceStatus === "loading" || faceStatus === "initializing") && (
                    <p className="text-xs text-muted-foreground text-center">
                      Loading face detection model, please wait...
                    </p>
                  )}
                </>
              )}
            </div>
            
            <div className="border-t border-border p-4 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={closeCamera}>
                Cancel
              </Button>
              <Button 
                onClick={handleCaptureAndPunch} 
                disabled={
                  isVerifyingLocation ||
                  !!cameraError ||
                  !stream ||
                  (!skipFaceCheck && !faceDetected)
                }
                className="gap-2"
              >
                <div className="h-4 w-4 rounded-full border-2 border-primary-foreground bg-transparent" />
                {isVerifyingLocation
                  ? "Verifying location…"
                  : `Capture & Punch ${cameraAction === "in" ? "In" : "Out"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
