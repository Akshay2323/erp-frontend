"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ShieldCheck, UserRound, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PasswordInput } from "@/components/auth/password-input";
import { changePassword, login, type LoginSuccessResponse } from "@/lib/api/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(100, "Username must be at most 100 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password must be at most 100 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Password change overlay state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempUserData, setTempUserData] = useState<LoginSuccessResponse["data"] | null>(null);
  const [tempUsername, setTempUsername] = useState("");
  const [tempRememberMe, setTempRememberMe] = useState(false);

  // States for password change form inside the modal
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  useEffect(() => {
    try {
      const savedUsername = localStorage.getItem("remembered_username");
      if (savedUsername) {
        setValue("username", savedUsername);
        setValue("rememberMe", true);
      }
    } catch (error) {
      console.warn("Unable to access localStorage:", error);
    }
  }, [setValue]);

  const finalizeLogin = (
    token: string,
    userData: LoginSuccessResponse["data"],
    username: string,
    rememberMe: boolean,
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

    try {
      localStorage.setItem("auth_user", JSON.stringify(authUser));
      if (rememberMe) {
        localStorage.setItem("remembered_username", username);
      } else {
        localStorage.removeItem("remembered_username");
      }
    } catch (error) {
      console.warn("Unable to access localStorage:", error);
    }
    setHomeDashboardCookie(authUser as AuthUser);

    toast.success(message || "Login successful");
    router.push(resolveHomeDashboardPath(authUser as AuthUser));
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      const response = await login({
        login: values.username,
        password: values.password,
        device_name: "web-app",
      });

      if (!response.success) {
        toast.error(response.message || "Invalid credentials");
        return;
      }

      if (values.password === "Welcome@123") {
        // Intercept and require password change
        setTempToken(response.data.token);
        setTempUserData(response.data);
        setTempUsername(values.username);
        setTempRememberMe(!!values.rememberMe);
        setIsChangePasswordOpen(true);
        // Reset form inputs
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError("");
        toast.info("Please change your default password to continue.");
        return;
      }

      finalizeLogin(
        response.data.token,
        response.data,
        values.username,
        !!values.rememberMe,
        response.message
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to connect to server. Please check API URL and try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword) {
      setPasswordError("New password is required.");
      return;
    }

    if (newPassword.toLowerCase() === "welcome@123") {
      setPasswordError("You cannot use the default password 'Welcome@123'. Please choose a different password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const token = tempToken;
    const userData = tempUserData;
    if (!token || !userData) {
      toast.error("Session expired. Please try logging in again.");
      setIsChangePasswordOpen(false);
      return;
    }

    setIsChangingPassword(true);
    try {
      const changeResponse = await changePassword(token, {
        current_password: "Welcome@123",
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      if (changeResponse.success !== false && changeResponse.status !== false) {
        toast.success("Password changed successfully!");
        setIsChangePasswordOpen(false);
        // Complete the login session
        finalizeLogin(
          token,
          userData,
          tempUsername,
          tempRememberMe,
          "Login successful"
        );
      } else {
        setPasswordError(changeResponse.message || "Failed to change password.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change password.";
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
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

        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <Card className="rounded-2xl border-border/80 shadow-xl shadow-black/5">
              <CardHeader className="space-y-2 pb-4">
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Login to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-5"
                  method="post"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit(onSubmit)(event);
                  }}
                >
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="username"
                    >
                      Mobile / Email / Employee Code
                    </label>
                    <div className="relative">
                      <UserRound
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        autoComplete="username"
                        id="username"
                        placeholder="Enter mobile, email, or code"
                        className="pl-9"
                        maxLength={100}
                        {...register("username")}
                      />
                    </div>
                    {errors.username ? (
                      <p className="text-xs text-destructive">
                        {errors.username.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <PasswordInput
                      autoComplete="current-password"
                      id="password"
                      placeholder="Enter your password"
                      maxLength={100}
                      {...register("password")}
                    />
                    {errors.password ? (
                      <p className="text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Controller
                      control={control}
                      name="rememberMe"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.value}
                            id="rememberMe"
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
                          />
                          <label
                            htmlFor="rememberMe"
                            className="text-sm text-muted-foreground select-none cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              field.onChange(!field.value);
                            }}
                          >
                            Remember me
                          </label>
                        </div>
                      )}
                    />
                    <Link
                      className="text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                      href="/forgot-password"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white transition-all shadow-md shadow-rose-500/10 focus-visible:ring-rose-500"
                    disabled={isLoading}
                    type="submit"
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Need help with location, camera, or installing the app?{" "}
                    <Link
                      className="font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                      href="/user-guidance"
                    >
                      User Guide
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            role="dialog"
          >
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Change Default Password
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your account is currently using the default password. For security reasons, you must change it before continuing.
                </p>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="newPassword">
                    New Password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    maxLength={100}
                    required
                  />
                </div>

                {passwordError && (
                  <div className="rounded-lg bg-destructive/15 p-3 text-xs text-destructive flex items-start gap-2">
                    <span className="font-semibold text-destructive">Error:</span>
                    <span className="text-destructive">{passwordError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isChangingPassword}
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setTempToken(null);
                      setTempUserData(null);
                      toast.warning("Login cancelled because password was not changed.");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white transition-all focus-visible:ring-rose-500"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
