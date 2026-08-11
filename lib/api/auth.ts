import { API_BASE_URL } from "@/lib/config";

export type LoginRequest = {
  login: string;
  password: string;
  device_name: string;
};

export type LoginSuccessResponse = {
  success: true;
  message: string;
  data: {
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
      /** HRMS `employees.id` — use this for `/v1/employees/{id}` (differs from auth `id` on many installs). */
      employee_id?: number;
      employee_code?: string;
      empcode?: string;
      employee?: { id?: number; employee_code?: string };
    };
    tenant?: {
      id: number;
      name: string;
    };
    company?: {
      id: number;
      name: string;
      code: string;
    };
    accessible_companies?: unknown[];
  };
  meta: Record<string, unknown>;
};

export type LoginFailedResponse = {
  success: false;
  message: string;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
};

export type LoginResponse = LoginSuccessResponse | LoginFailedResponse;

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}v1/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Unable to reach the API server. Check your network connection or contact support.",
    );
  }

  const rawText = await response.text();
  let result: LoginResponse;
  try {
    result = JSON.parse(rawText) as LoginResponse;
  } catch {
    if (response.status === 502) {
      throw new Error(
        "API server is unreachable. Please contact your administrator.",
      );
    }
    if (response.status >= 500) {
      throw new Error(
        "Server error while connecting to API. Please try again or contact support.",
      );
    }
    throw new Error(
      response.ok
        ? "Invalid response from server."
        : `Login failed (${response.status}). Please try again.`,
    );
  }

  return result;
}

export async function logout(token: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${API_BASE_URL}v1/auth/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: "",
      // Mobile Safari can stall open requests; logout must not hang the UI.
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
};

export type ChangePasswordResponse = {
  success?: boolean;
  status?: boolean;
  message: string;
};

export async function changePassword(
  token: string,
  payload: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
  const response = await fetch(`${API_BASE_URL}v1/auth/change-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const ok = response.ok && (result.success !== false && result.status !== false);
  if (!response.ok || !ok) {
    throw new Error(result.message || "Failed to change password");
  }
  return result as ChangePasswordResponse;
}

export type ForgotPasswordRequest = {
  login: string;
};

export type ForgotPasswordResponse = {
  success: boolean;
  message: string;
  data: {
    otp?: string;
    otp_length?: number;
    expires_at?: string;
    masked_email?: string;
  };
  meta: Record<string, unknown>;
};

export type VerifyOtpRequest = {
  login: string;
  otp: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  data: {
    reset_token: string;
    reset_token_expires_at: string;
  };
  meta: Record<string, unknown>;
};

export type ResetPasswordRequest = {
  login: string;
  reset_token: string;
  password: string;
  password_confirmation: string;
};

export type ResetPasswordResponse = {
  success: boolean;
  message: string;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
};

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const response = await fetch(`${API_BASE_URL}v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to generate password reset OTP");
  }
  return result as ForgotPasswordResponse;
}

export async function verifyOtp(payload: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  const response = await fetch(`${API_BASE_URL}v1/auth/verify-otp`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Invalid or expired OTP");
  }
  return result as VerifyOtpResponse;
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const response = await fetch(`${API_BASE_URL}v1/auth/reset-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to reset password");
  }
  return result as ResetPasswordResponse;
}

