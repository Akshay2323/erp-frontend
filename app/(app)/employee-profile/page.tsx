"use client";

import { useEffect, useState, useRef } from "react";
import { 
  User, 
  Mail, 
  Building, 
  Phone,
  Calendar,
  ArrowLeft,
  Briefcase,
  GitBranch,
  UserCheck,
  Award,
  CreditCard,
  Home,
  Heart,
  MapPin,
  Activity,
  Copy,
  Check,
  Camera,
  CalendarRange,
  Settings2,
  Loader2,
  Coins,
  ShieldAlert,
  Lock
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getEmployeeDetail, resolveEmployeeSession, uploadProfilePhoto } from "@/lib/api/employee";
import { getEmployeeProfilePhotoUrl, fetchEmployeeProfilePhotoBlobUrl } from "@/lib/api/employees/http";
import { useAuthToken } from "@/lib/use-auth-token";
import { isAdminSession, isSuperAdminSession, resolveRoleString } from "@/lib/auth-session";
import { useAccentTheme } from "@/components/accent-theme-provider";
import { AccentThemePicker } from "@/components/accent-theme-picker";

/** True when the auth user is explicitly linked to an employee record. */
function hasEmployeeLink(u: unknown): boolean {
  if (!u || typeof u !== "object") return false;
  const user = u as Record<string, any>;
  const id = user.employee_id ?? user.employeeId ?? user.employee?.id;
  if (id != null && Number(id) > 0) return true;
  const code =
    user.employee_code ?? user.empcode ?? user.emp_code ?? user.employee?.employee_code;
  return typeof code === "string" && code.trim() !== "";
}

/** Admins without their own employee record must not be mapped to another employee. */
function shouldResolveEmployee(u: unknown): boolean {
  if (!u) return false;
  if (hasEmployeeLink(u)) return true;
  return !(isAdminSession(u as any) || isSuperAdminSession(u as any));
}

export default function ProfilePage() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthToken();
  const { theme } = useAccentTheme();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [profilePhotoSrc, setProfilePhotoSrc] = useState<string | null>(null);
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    try {
      const storedUser = localStorage.getItem("auth_user");

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setSessionUser(parsedUser);

        const resolved =
          token && parsedUser && shouldResolveEmployee(parsedUser)
            ? await resolveEmployeeSession(token, parsedUser)
            : null;
        const empId = resolved?.employeeId;

        if (empId && token) {
          setEmployeeId(empId);
          try {
            const res = await getEmployeeDetail(token, empId);
            const data = (res?.data as { employee?: unknown })?.employee ?? res?.data ?? null;
            if (data) {
              setEmployeeDetails(data);
            }
          } catch (err) {
            console.warn("Could not fetch employee API details, falling back to session user:", err);
          }
        } else {
          setEmployeeId(null);
        }
      }
    } catch (e) {
      console.error("Failed to load user session:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  useEffect(() => {
    if (!token || !employeeDetails) {
      setProfilePhotoSrc(null);
      setProfilePhotoLoading(false);
      return;
    }

    const photoUrl = getEmployeeProfilePhotoUrl(employeeDetails, employeeId);
    if (!photoUrl) {
      setProfilePhotoSrc(null);
      setProfilePhotoLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadPhoto = async () => {
      setProfilePhotoLoading(true);
      try {
        objectUrl = await fetchEmployeeProfilePhotoBlobUrl(
          token,
          employeeDetails,
          employeeId,
        );
        if (!cancelled) {
          setProfilePhotoSrc(objectUrl);
        }
      } catch {
        if (!cancelled) setProfilePhotoSrc(null);
      } finally {
        if (!cancelled) setProfilePhotoLoading(false);
      }
    };

    void loadPhoto();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, employeeDetails, employeeId]);

  const getInitials = (name: string) => {
    if (!name?.trim()) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image file size must be less than 3MB");
      return;
    }

    const resolved =
      sessionUser && shouldResolveEmployee(sessionUser)
        ? await resolveEmployeeSession(token, sessionUser)
        : null;
    const empId = resolved?.employeeId;

    if (!empId || !token) {
      toast.error("No employee record is linked to this account, so a profile photo cannot be uploaded.");
      return;
    }

    setPhotoUploading(true);
    try {
      const res = await uploadProfilePhoto(token, empId, file);
      toast.success(res.message || "Profile photo updated successfully!");
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload profile photo");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string, label: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getTenureString = (joinDateStr: string) => {
    if (!joinDateStr || joinDateStr === "—") return "—";
    try {
      const joinDate = new Date(joinDateStr);
      if (isNaN(joinDate.getTime())) return "—";
      const now = new Date();
      
      let years = now.getFullYear() - joinDate.getFullYear();
      let months = now.getMonth() - joinDate.getMonth();
      
      if (months < 0) {
        years--;
        months += 12;
      }
      
      if (years === 0 && months === 0) {
        return "Joined this month";
      }
      
      const yearsPart = years > 0 ? `${years} yr${years > 1 ? "s" : ""}` : "";
      const monthsPart = months > 0 ? `${months} mo${months > 1 ? "s" : ""}` : "";
      
      return [yearsPart, monthsPart].filter(Boolean).join(" ") + " ago";
    } catch {
      return "—";
    }
  };

  const getCompletionPercentage = (emp: any) => {
    if (!emp) return 0;
    const pd = emp.personal_details || emp.personal_detail || emp || {};
    const cd = emp.contact_details || emp.contact_detail || emp || {};
    const bd = emp.bank_details || emp.bank_detail || emp || {};
    const std = emp.statutory_details || emp.statutory_detail || emp || {};

    const fields = [
      emp.full_name || emp.name,
      emp.email,
      emp.mobile || emp.phone,
      emp.joining_date,
      emp.employee_code,
      pd.date_of_birth,
      pd.gender,
      pd.nationality,
      cd.current_address,
      bd.bank_name,
      bd.account_number,
      std.pan_number || std.pan_no,
      std.aadhaar_number || std.aadhaar_no,
    ];
    
    const filled = fields.filter(f => f !== undefined && f !== null && String(f).trim() !== "" && String(f) !== "0" && String(f) !== "—").length;
    return Math.round((filled / fields.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-semibold">Loading your employee profile...</p>
      </div>
    );
  }

  // Parse details
  const userDisplayName =
    employeeDetails?.full_name ||
    employeeDetails?.name ||
    `${employeeDetails?.first_name ?? ""} ${employeeDetails?.last_name ?? ""}`.trim() ||
    sessionUser?.name ||
    "User";
  const userDisplayEmail = employeeDetails?.email || sessionUser?.email || "—";
  const userDisplayRole = resolveRoleString(sessionUser) || "Employee";
  const userCode = employeeDetails?.employee_code || "—";
  const userPhone = employeeDetails?.mobile || employeeDetails?.phone || "—";
  const userJoinDateRaw = employeeDetails?.joining_date;
  const userJoinDate = userJoinDateRaw ? new Date(userJoinDateRaw).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const userStatus = employeeDetails?.status || "active";
  const showProfilePhoto = Boolean(profilePhotoSrc) && !profilePhotoLoading;
  const userInitials = getInitials(userDisplayName);

  const pd = employeeDetails?.personal_detail || employeeDetails?.personal_details || employeeDetails || {};
  const cd = employeeDetails?.contact_detail || employeeDetails?.contact_details || employeeDetails || {};
  const jd = employeeDetails?.job_detail || employeeDetails?.job_details || employeeDetails || {};
  const bd = employeeDetails?.bank_detail || employeeDetails?.bank_details || employeeDetails || {};
  const std = employeeDetails?.statutory_detail || employeeDetails?.statutory_details || employeeDetails || {};
  const lb = employeeDetails?.leave_balance || {};

  const userCompany = employeeDetails?.company?.name || sessionUser?.company?.name || "—";
  const userBranch = employeeDetails?.branch?.name || "—";
  const userDepartment = employeeDetails?.department?.name || jd?.department?.name || "—";
  const userDesignation = employeeDetails?.designation?.name || jd?.designation?.name || "—";
  
  const getManagerName = () => {
    const mgr = employeeDetails?.reporting_manager || jd?.reporting_manager;
    if (mgr) {
      if (mgr.first_name || mgr.last_name) {
        return `${mgr.first_name || ""} ${mgr.last_name || ""}`.trim();
      }
      return mgr.name || mgr.full_name || "—";
    }
    return "—";
  };
  const userManager = getManagerName();

  const completionRate = getCompletionPercentage(employeeDetails);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-1 sm:px-2 py-2">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link 
          href="/employee-dashboard" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Dashboard
        </Link>
        <span className="text-xs text-muted-foreground font-mono bg-muted/70 backdrop-blur px-3 py-1 rounded-full border border-border">
          Active HR Profile
        </span>
      </div>

      {/* Dynamic Theme Banner & Profile Hero Card */}
      <div className={`relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r ${theme.banner} p-5 md:p-6 shadow-lg transition-all duration-500`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />
        <div className="absolute inset-0 bg-grid-white/[0.03] -z-10" />

        {/* Float Glassmorphic Accent Selector */}
        <AccentThemePicker
          className="relative md:absolute md:top-4 md:right-4 mx-auto mb-4 w-fit md:mx-0 md:mb-0 max-w-[min(100%,22rem)]"
          variant="banner"
        />

        {/* Profile Info Row */}
        <div className="flex flex-col md:flex-row items-center gap-5 mt-2">
          <div className="relative group">
            {/* Avatar Glow Ring */}
            <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${theme.banner} opacity-70 blur-sm transition-all duration-300 group-hover:opacity-100`} />
            
            <div className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-card overflow-hidden border-2 border-white shadow-xl ring-2 ${theme.avatarRing} transition-all duration-300`}>
              {profilePhotoLoading ? (
                <div className="flex h-full w-full items-center justify-center bg-muted/40">
                  <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                </div>
              ) : showProfilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhotoSrc!}
                  alt={userDisplayName}
                  className="h-full w-full object-cover"
                  onError={() => setProfilePhotoSrc(null)}
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${theme.banner} text-white text-2xl font-extrabold tracking-wide`}>
                  {userInitials}
                </div>
              )}

              {/* Upload photo overlay */}
              <button
                onClick={handlePhotoClick}
                disabled={photoUploading}
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200 text-white"
              >
                {photoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-4.5 w-4.5" />
                    <span className="text-[8px] font-medium mt-0.5">Upload</span>
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <div className="text-center md:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">{userDisplayName}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {userStatus}
              </span>
            </div>
            <p className="text-white/80 text-xs font-medium flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="capitalize font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm">{userDisplayRole}</span>
              <span className="text-white/30">•</span>
              <span>{userDisplayEmail}</span>
              <span className="text-white/30">•</span>
              <span className="font-mono text-white/95">{userCode}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Full Page Layout Grid */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* LEFT COLUMN: Main Details Cards (Personal, Job, Bank) */}
        <div className="flex flex-col gap-6 md:col-span-8">
          
          {/* Card 1: Personal & Contact Details */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
            <div className={`flex items-center gap-2.5 pb-3 border-b border-border/40`}>
              <div className={`p-2 rounded-xl ${theme.accentBg} ${theme.accentText}`}>
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Personal & Contact Details</h2>
                <p className="text-xs text-muted-foreground">Demographics, contacts, and off-duty address listings.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Full Name</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userDisplayName}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Personal Email</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30 truncate">
                  {cd.personal_email || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Date of Birth</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {pd.date_of_birth ? new Date(pd.date_of_birth).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Gender</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30 capitalize">
                  {pd.gender || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Nationality</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {pd.nationality || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Blood Group</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {pd.blood_group || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Marital Status</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30 capitalize">
                  {pd.marital_status || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Work Contact</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userPhone}
                </p>
              </div>
            </div>

            {/* Address Blocks */}
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <div className="rounded-xl border border-border/75 p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Current Address
                </span>
                <p className="text-xs font-semibold text-foreground bg-muted/10 p-2 rounded border border-border/20 leading-relaxed">
                  {cd.current_address || "No address logged."}
                </p>
              </div>

              <div className="rounded-xl border border-border/75 p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
                  <Home className="h-3.5 w-3.5 text-muted-foreground" /> Permanent Address
                </span>
                <p className="text-xs font-semibold text-foreground bg-muted/10 p-2 rounded border border-border/20 leading-relaxed">
                  {cd.permanent_address || "No address logged."}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Job & Organization Details */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
            <div className={`flex items-center gap-2.5 pb-3 border-b border-border/40`}>
              <div className={`p-2 rounded-xl ${theme.accentBg} ${theme.accentText}`}>
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Job & Organization Details</h2>
                <p className="text-xs text-muted-foreground">Corporate placement structure, policies, and schedules.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Company</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userCompany}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Branch</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userBranch}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Department</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userDepartment}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Designation</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {userDesignation}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Employment Type</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30 capitalize">
                  {(jd.employment_type || "—").replace(/_/g, " ")}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Probation period</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {jd.probation_period ? `${jd.probation_period} Months` : "No probation period"}
                </p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Shift Schedule</p>
                <p className="font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                  {jd.shift?.name || jd.shift?.shift_code || "Standard General Shift"}
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Bank & Statutory Details */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
            <div className={`flex items-center gap-2.5 pb-3 border-b border-border/40`}>
              <div className={`p-2 rounded-xl ${theme.accentBg} ${theme.accentText}`}>
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Bank & Statutory Details</h2>
                <p className="text-xs text-muted-foreground">Salary disbursement routing numbers and tax documentation details.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Bank accounts sub-block */}
              <div className="rounded-xl border border-border p-4 bg-muted/5 space-y-3.5">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Coins className={`h-4.5 w-4.5 ${theme.accentText}`} /> Bank Account Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="space-y-0.5 bg-card p-2.5 rounded-lg border border-border/60">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Holder Name</p>
                    <p className="font-semibold">{bd.account_holder_name || userDisplayName}</p>
                  </div>
                  <div className="space-y-0.5 bg-card p-2.5 rounded-lg border border-border/60">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Bank Name</p>
                    <p className="font-semibold">{bd.bank_name || "—"}</p>
                  </div>
                  <div className="space-y-0.5 bg-card p-2.5 rounded-lg border border-border/60 relative">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Account Number</p>
                    <p className="font-semibold font-mono tracking-wide">
                      {bd.account_number 
                        ? `${bd.account_number.substring(0, 3)}••••••${bd.account_number.slice(-4)}` 
                        : "—"}
                    </p>
                    {bd.account_number && (
                      <button
                        onClick={() => copyToClipboard(String(bd.account_number), "Account Number", "acct")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        {copiedField === "acct" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 bg-card p-2.5 rounded-lg border border-border/60 relative">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">IFSC Code</p>
                    <p className="font-semibold font-mono">{bd.ifsc_code || "—"}</p>
                    {bd.ifsc_code && (
                      <button
                        onClick={() => copyToClipboard(String(bd.ifsc_code), "IFSC Code", "ifsc")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        {copiedField === "ifsc" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Statutory details sub-block */}
              <div className="rounded-xl border border-border p-4 bg-muted/5 space-y-3.5">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <UserCheck className={`h-4.5 w-4.5 ${theme.accentText}`} /> Tax & Statutory Identifiers
                </h3>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="bg-card p-3 rounded-lg border border-border/60 space-y-1 relative">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">PAN Card No.</p>
                    <p className="text-xs font-mono font-bold tracking-wider">{std.pan_number || std.pan_no || "—"}</p>
                    {(std.pan_number || std.pan_no) && (
                      <button
                        onClick={() => copyToClipboard(String(std.pan_number || std.pan_no), "PAN number", "pan")}
                        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                      >
                        {copiedField === "pan" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="bg-card p-3 rounded-lg border border-border/60 space-y-1 relative">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Aadhaar Card No.</p>
                    <p className="text-xs font-mono font-bold tracking-wider">
                      {std.aadhaar_number || std.aadhaar_no
                        ? `•••• •••• ${String(std.aadhaar_number || std.aadhaar_no).slice(-4)}`
                        : "—"}
                    </p>
                    {(std.aadhaar_number || std.aadhaar_no) && (
                      <button
                        onClick={() => copyToClipboard(String(std.aadhaar_number || std.aadhaar_no), "Aadhaar number", "aadhaar")}
                        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                      >
                        {copiedField === "aadhaar" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="bg-card p-3 rounded-lg border border-border/60 space-y-1 relative">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">UAN Number</p>
                    <p className="text-xs font-mono font-bold tracking-wider">{std.uan_number || std.uan_no || "—"}</p>
                    {(std.uan_number || std.uan_no) && (
                      <button
                        onClick={() => copyToClipboard(String(std.uan_number || std.uan_no), "UAN number", "uan")}
                        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                      >
                        {copiedField === "uan" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Metadata Widgets */}
        <div className="flex flex-col gap-6 md:col-span-4">
          
          {/* Card 4: Profile Status Meter */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground">Profile Status</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${theme.badgeAccent}`}>
                {completionRate}% Filled
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full bg-gradient-to-r ${theme.banner} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {completionRate < 100 
                  ? "Help HR keep records correct by updating missing details."
                  : "Brilliant! Your employee records are fully populated."}
              </p>
            </div>
          </div>

          {/* Card 5: Tenure & Anniversary */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3.5">
            <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <Award className={`h-4 w-4 ${theme.accentText}`} /> Tenure & Anniversary
            </h3>
            <div className="bg-muted/15 p-3.5 rounded-xl border border-border/50 space-y-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Joining Date</p>
              <p className="text-sm font-bold text-foreground">{userJoinDate}</p>
              <p className={`text-xs font-semibold ${theme.accentText}`}>
                Joined {getTenureString(userJoinDateRaw || "")}
              </p>
            </div>
          </div>

          {/* Card 6: Reporting Manager */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <UserCheck className={`h-4 w-4 ${theme.accentText}`} /> Reporting Manager
            </h3>
            <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/40">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.banner} text-white font-extrabold text-sm shadow-md`}>
                {getInitials(userManager)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{userManager}</p>
                <p className="text-[10px] text-muted-foreground font-semibold">Primary Approver</p>
              </div>
            </div>
          </div>

          {/* Card 7: Leave Balances */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <CalendarRange className={`h-4 w-4 ${theme.accentText}`} /> Allocated Leaves
            </h3>
            
            {lb.casual_leave !== undefined ? (
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="bg-muted/15 p-2 rounded-xl border border-border/50">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Casual</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{lb.casual_leave}</p>
                </div>
                <div className="bg-muted/15 p-2 rounded-xl border border-border/50">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Sick</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{lb.sick_leave}</p>
                </div>
                <div className="bg-muted/15 p-2 rounded-xl border border-border/50">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Earned</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{lb.earned_leave}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                No leave allocations found.
              </div>
            )}
          </div>

          {/* Card 8: Emergency Contacts */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3.5">
            <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className={`h-4 w-4 ${theme.accentText}`} /> Emergency Contact
            </h3>
            {cd.emergency_contact_name ? (
              <div className="space-y-1 bg-muted/15 p-3 rounded-xl border border-border/50">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3 text-muted-foreground" /> {cd.emergency_contact_name}
                </p>
                {cd.emergency_contact_phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-mono">
                    <Phone className="h-3 w-3 text-muted-foreground" /> {cd.emergency_contact_phone}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                No emergency contacts declared.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
