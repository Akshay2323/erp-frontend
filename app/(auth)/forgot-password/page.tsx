"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { setClientAuthCheckedCookie } from "@/lib/auth-cache";
import { clearAuthMeCache } from "@/lib/auth-me-cache";
import { setAuthTokenCookie, setHomeDashboardCookie } from "@/lib/auth-cookie";
import { resolveHomeDashboardPath, type AuthUser } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { forgotPassword, verifyOtp, resetPassword, login, type LoginSuccessResponse } from "@/lib/api/auth";
import { PasswordInput } from "@/components/auth/password-input";

type Step = "IDENTIFY" | "VERIFY" | "RESET" | "SUCCESS";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("IDENTIFY");
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const finalizeLogin = (
    token: string,
    userData: LoginSuccessResponse["data"],
    username: string,
    message: string
  ) => {
    setAuthTokenCookie(token);
    clearAuthMeCache();
    setClientAuthCheckedCookie();
    
    const apiUser = userData.user as typeof userData.user & {
      employee_id?: number;
      employee_code?: string;
      empcode?: string;
      employee?: { id?: number; employee_code?: string };
    };
    
    const authUser = {
      ...apiUser,
      employee_id: apiUser.employee_id ?? apiUser.employee?.id,
      employee_code:
        apiUser.employee_code ??
        apiUser.empcode ??
        apiUser.employee?.employee_code,
      company: userData.company,
      tenant: userData.tenant,
      accessible_companies: userData.accessible_companies,
    };

    localStorage.setItem("auth_user", JSON.stringify(authUser));
    setHomeDashboardCookie(authUser as AuthUser);

    toast.success(message);
    router.push(resolveHomeDashboardPath(authUser as AuthUser));
  };

  // Step 1: Identify States
  const [identifier, setIdentifier] = useState("");

  // Step 2: Verification States
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [resendTimer, setResendTimer] = useState(60);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 3: Reset States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Auto-detect input type (email vs phone number vs employee code)
  const trimmedIdentifier = identifier.trim();
  let identifierType: "email" | "phone" | "code" | "unknown" = "unknown";
  if (!trimmedIdentifier) {
    identifierType = "unknown";
  } else if (trimmedIdentifier.includes("@")) {
    identifierType = "email";
  } else if (/^\+?[0-9\s-]{8,15}$/.test(trimmedIdentifier)) {
    identifierType = "phone";
  } else if (trimmedIdentifier.length >= 3) {
    identifierType = "code";
  } else {
    identifierType = "unknown";
  }

  // Step 2: OTP timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "VERIFY" && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Step 1: Submit Identifier
  const handleIdentifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your Email, Mobile, or Employee Code");
      return;
    }

    setIsLoading(true);
    forgotPassword({ login: identifier })
      .then((res) => {
        toast.success(res.message || "Verification code sent!");
        setStep("VERIFY");
        setResendTimer(60);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to generate OTP.";
        toast.error(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Step 2: OTP inputs behavior
  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digits
    const digit = value.slice(-1);
    if (digit && !/^\d$/.test(digit)) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) {
      toast.error("Please paste a 6-digit number");
      return;
    }

    const digits = pastedData.split("");
    setOtp(digits);
    otpRefs.current[5]?.focus();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setIsLoading(true);
    verifyOtp({ login: identifier, otp: code })
      .then((res) => {
        toast.success(res.message || "OTP verified successfully!");
        setResetToken(res.data.reset_token);
        setStep("RESET");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Invalid or expired OTP.";
        toast.error(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleResendCode = () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    forgotPassword({ login: identifier })
      .then((res) => {
        setResendTimer(60);
        setOtp(Array(6).fill(""));
        otpRefs.current[0]?.focus();
        toast.success(res.message || "A new verification code has been sent!");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to resend verification code.";
        toast.error(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Step 3: Password Strength checklist calculations
  const passwordCriteria = {
    length: newPassword.length >= 8,
    number: /\d/.test(newPassword),
    upper: /[A-Z]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    match: newPassword === confirmPassword && confirmPassword.length > 0,
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast.error("Please satisfy all password complexity rules.");
      return;
    }

    setIsLoading(true);
    resetPassword({
      login: identifier,
      reset_token: resetToken,
      password: newPassword,
      password_confirmation: confirmPassword,
    })
      .then((res) => {
        toast.success(res.message || "Password reset successfully!");
        
        // Log the user in automatically with the new password
        return login({
          login: identifier,
          password: newPassword,
          device_name: "web-app",
        });
      })
      .then((loginRes) => {
        if (!loginRes.success) {
          toast.warning("Password reset successfully! Please login manually.");
          router.push("/login");
          return;
        }
        finalizeLogin(
          loginRes.data.token,
          loginRes.data,
          identifier,
          "Password reset and logged in successfully!"
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to reset password.";
        toast.error(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Left Side: Brand Banner - consistent with Login design */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-red-50 via-rose-100/80 to-red-100 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16 border-r border-rose-200/40">
          <div className="relative z-10 space-y-6">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-200/60 text-rose-700 backdrop-blur-xs">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight text-rose-950">
                Smart <span className="text-rose-600">ERP</span>
              </h1>
              <p className="max-w-md text-base text-rose-900/80">
                Enterprise Resource Planning portal for workforce, attendance, and payroll operations.
              </p>
            </div>

            {/* ERP Modules List */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-rose-200/30 bg-white/20 hover:bg-white/45 transition-all shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-200/50 text-rose-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-rose-950">Employee Management</h3>
                  <p className="text-xs text-rose-900/70">Centralized profile records & job contracts</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-rose-200/30 bg-white/20 hover:bg-white/45 transition-all shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-200/50 text-rose-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-rose-950">Attendance & Shifts</h3>
                  <p className="text-xs text-rose-900/70">Real-time punch tracker & geofenced leaves</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-rose-200/30 bg-white/20 hover:bg-white/45 transition-all shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-200/50 text-rose-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-rose-950">Payroll & Salary</h3>
                  <p className="text-xs text-rose-900/70">Automated payroll, taxes, and payslip generation</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-rose-200/60 bg-white/40 p-4 backdrop-blur-sm shadow-sm shadow-rose-950/5">
            <p className="text-xs text-center text-rose-900/80 font-medium">
              Enterprise Grade • Secure Role-Based Access Control
            </p>
          </div>
        </aside>

        {/* Right Side: Interactive Forms with Step Transitions */}
        <div className="flex items-center justify-center p-4 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <Card className="rounded-2xl border-border/80 shadow-xl shadow-black/5 overflow-hidden transition-all duration-300">
              
              {/* Step 1: Identify Account */}
              {step === "IDENTIFY" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <CardHeader className="space-y-2 pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Fingerprint className="h-6 w-6 text-rose-500 dark:text-rose-400" />
                      Forgot Password
                    </CardTitle>
                    <CardDescription>
                      Enter your credentials below and we will send you a verification code.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <form onSubmit={handleIdentifySubmit} className="space-y-5">
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium text-foreground"
                          htmlFor="identifier"
                        >
                          Email / Mobile / Employee Code
                        </label>
                        <div className="relative">
                          {identifierType === "email" && (
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500 dark:text-rose-400 transition-colors" />
                          )}
                          {identifierType === "phone" && (
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500 dark:text-rose-400 transition-colors" />
                          )}
                          {(identifierType === "code" || identifierType === "unknown") && (
                            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
                          )}
                          <Input
                            autoComplete="username"
                            id="identifier"
                            placeholder="Enter email, mobile, or code"
                            className="pl-9 transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={isLoading}
                            maxLength={100}
                            required
                          />
                        </div>
                        {identifier.trim().length > 0 && (
                          <p className="text-[11px] text-muted-foreground transition-all">
                            Detected Format:{" "}
                            <span className="font-semibold text-rose-500 dark:text-rose-400 capitalize">
                              {identifierType === "unknown" ? "Typing..." : identifierType === "code" ? "Employee Code" : identifierType}
                            </span>
                          </p>
                        )}
                      </div>

                      <Button className="w-full gap-2 cursor-pointer bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white transition-all shadow-md shadow-rose-500/10 focus-visible:ring-rose-500" type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Sending code...
                          </>
                        ) : (
                          <>
                            Send Verification Code
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>

                      <div className="text-center pt-2">
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline rounded-sm"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to Login
                        </Link>
                      </div>
                    </form>
                  </CardContent>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {step === "VERIFY" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader className="space-y-2 pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-6 w-6 text-rose-500 dark:text-rose-400" />
                      Verification Code
                    </CardTitle>
                    <CardDescription>
                      We have sent a 6-digit verification code to you. Enter it below to proceed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <form onSubmit={handleVerifySubmit} className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground block text-center">
                          Enter 6-Digit Passcode
                        </label>
                        <div className="flex justify-between gap-1 sm:gap-2 w-full max-w-xs sm:max-w-sm mx-auto" onPaste={handleOtpPaste}>
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              type="text"
                              maxLength={1}
                              pattern="\d*"
                              inputMode="numeric"
                              ref={(el) => {
                                otpRefs.current[idx] = el;
                              }}
                              className="w-full max-w-[38px] aspect-square sm:max-w-[48px] text-center text-base sm:text-xl font-semibold rounded-xl border border-input bg-background focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition-all min-w-0"
                              value={digit}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              disabled={isLoading}
                            />
                          ))}
                        </div>
                      </div>

                      <Button className="w-full gap-2 cursor-pointer bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white transition-all shadow-md shadow-rose-500/10 focus-visible:ring-rose-500" type="submit" disabled={isLoading || otp.join("").length < 6}>
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Verify Code
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>

                      <div className="flex flex-col items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={resendTimer > 0 || isLoading}
                          className="text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-350 hover:underline disabled:text-muted-foreground disabled:no-underline transition-all cursor-pointer"
                        >
                          {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Verification Code"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStep("IDENTIFY");
                            setOtp(Array(6).fill(""));
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer"
                          disabled={isLoading}
                        >
                          <ArrowLeft className="h-3 w-3" />
                          Change email / mobile
                        </button>
                      </div>
                    </form>
                  </CardContent>
                </div>
              )}

              {/* Step 3: Password Reset */}
              {step === "RESET" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <CardHeader className="space-y-2 pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-6 w-6 text-rose-500 dark:text-rose-400" />
                      Create New Password
                    </CardTitle>
                    <CardDescription>
                      Your identity is confirmed. Please specify your new access credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <form onSubmit={handleResetSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="newPassword">
                          New Password
                        </label>
                        <PasswordInput
                          id="newPassword"
                          placeholder="Enter secure password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onFocus={() => setIsPasswordFocused(true)}
                          onBlur={() => setIsPasswordFocused(false)}
                          disabled={isLoading}
                          maxLength={100}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">
                          Confirm Password
                        </label>
                        <PasswordInput
                          id="confirmPassword"
                          placeholder="Re-enter secure password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={isLoading}
                          maxLength={100}
                          required
                        />
                      </div>

                      {/* Animated Password Complexity Checker */}
                      <div className={`p-4 rounded-xl border bg-muted/30 space-y-2.5 transition-all duration-300 ${isPasswordFocused || newPassword.length > 0 ? "opacity-100 max-h-56" : "opacity-80"}`}>
                        <p className="text-xs font-semibold text-foreground">Password requirements:</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${passwordCriteria.length ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-muted-foreground/45"}`} />
                            <span className={passwordCriteria.length ? "text-green-600 font-medium dark:text-green-400" : ""}>
                              Minimum 8 characters
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${passwordCriteria.upper ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-muted-foreground/45"}`} />
                            <span className={passwordCriteria.upper ? "text-green-600 font-medium dark:text-green-400" : ""}>
                              At least one uppercase letter (A-Z)
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${passwordCriteria.number ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-muted-foreground/45"}`} />
                            <span className={passwordCriteria.number ? "text-green-600 font-medium dark:text-green-400" : ""}>
                              At least one digit (0-9)
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${passwordCriteria.special ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-muted-foreground/45"}`} />
                            <span className={passwordCriteria.special ? "text-green-600 font-medium dark:text-green-400" : ""}>
                              At least one special character (!@#$%)
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${passwordCriteria.match ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-muted-foreground/45"}`} />
                            <span className={passwordCriteria.match ? "text-green-600 font-medium dark:text-green-400" : ""}>
                              Passwords match
                            </span>
                          </li>
                        </ul>
                      </div>

                      <Button className="w-full gap-2 cursor-pointer bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white transition-all shadow-md shadow-rose-500/10 focus-visible:ring-rose-500" type="submit" disabled={isLoading || !isPasswordValid}>
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Updating password...
                          </>
                        ) : (
                          <>
                            Reset Password
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </div>
              )}

              {/* Step 4: Success Screen */}
              {step === "SUCCESS" && (
                <div className="animate-in zoom-in-95 duration-300">
                  <CardHeader className="text-center space-y-3 pt-8 pb-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 animate-bounce">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-bold tracking-tight">
                        Password Reset
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Your account credentials have been successfully updated.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 px-4 sm:px-6 pb-8">
                    <div className="rounded-xl border bg-muted/20 p-4 text-xs text-center text-muted-foreground">
                      For your security, you have been logged out of all active sessions on other devices. Please login using your new password.
                    </div>
                    <Button className="w-full cursor-pointer" onClick={() => router.push("/login")}>
                      Proceed to Login
                    </Button>
                  </CardContent>
                </div>
              )}

            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
