"use client";

import { useState } from "react";
import { 
  Lock, 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { changePassword } from "@/lib/api/auth";
import { useAuthToken } from "@/lib/use-auth-token";
import { useAccentTheme } from "@/components/accent-theme-provider";
import { AccentThemePicker } from "@/components/accent-theme-picker";

export default function ChangePasswordPage() {
  const token = useAuthToken();
  const { theme } = useAccentTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Show/Hide Password States
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setPasswordChanging(true);
    try {
      const res = await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      toast.success(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password. Please verify current password.");
    } finally {
      setPasswordChanging(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-2 sm:px-4 py-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link 
          href="/employee-dashboard" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group font-medium"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Dashboard
        </Link>
        <span className="text-xs text-muted-foreground font-mono bg-muted/70 backdrop-blur px-3 py-1 rounded-full border border-border">
          Security Controls
        </span>
      </div>

      {/* Dynamic Theme Banner Header */}
      <div className={`relative overflow-hidden rounded-2xl border border-border/85 bg-gradient-to-r ${theme.banner} p-5 md:p-6 shadow-md transition-all duration-500`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />
        <div className="absolute inset-0 bg-grid-white/[0.03] -z-10" />

        {/* Float Accent Selector */}
        <AccentThemePicker
          className="relative md:absolute md:top-4 md:right-4 mx-auto mb-4 w-fit md:mx-0 md:mb-0 max-w-[min(100%,22rem)]"
          variant="banner"
        />

        {/* Info Column */}
        <div className="flex items-center gap-4 mt-2">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 shadow-inner`}>
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Change Account Password</h1>
            <p className="text-xs text-white/80 font-medium">Protect your HRMS account credentials by configuring a robust new password.</p>
          </div>
        </div>
      </div>

      {/* Main Grid Centering Form */}
      <div className="grid gap-6 md:grid-cols-12 items-start justify-center">
        {/* Left Card: General Information */}
        <div className="md:col-span-5 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 relative overflow-hidden">
            <div className={`absolute top-0 right-0 h-28 w-28 rounded-full blur-3xl opacity-20 -z-10 transition-all ${theme.glassAccent}`} />
            
            <h3 className="font-bold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className={`h-4 w-4 ${theme.accentText}`} /> Security Advice
            </h3>
            
            <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Use at least 8 characters with a mix of symbols, letters, and numbers.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Avoid using easily guessable info like names, emails, or date of birth details.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Password modifications are logged and active sessions remain connected unless revoked.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card: Form Inputs */}
        <div className="md:col-span-7">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 h-40 w-40 rounded-full blur-3xl opacity-35 -z-10 transition-all ${theme.glassAccent}`} />
            
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
              <div className={`p-2 rounded-xl ${theme.accentBg} ${theme.accentText}`}>
                <Lock className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Configure Credentials</h3>
                <p className="text-xs text-muted-foreground">Type in details to complete authorization update.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 text-sm mt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex h-10 w-full rounded-xl border border-border bg-background pl-3.5 pr-10 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={passwordChanging}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex h-10 w-full rounded-xl border border-border bg-background pl-3.5 pr-10 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={passwordChanging}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex h-10 w-full rounded-xl border border-border bg-background pl-3.5 pr-10 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={passwordChanging}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordChanging}
                className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${theme.tabActive} disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] mt-2`}
              >
                {passwordChanging ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Updating Credentials...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Update Account Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
