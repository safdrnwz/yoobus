import { http } from '@/core/api/http-client';
import type { AuthUser } from '@/core/auth/auth.store';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginPayload {
  /** Registered email, or the 10-digit mobile number. */
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  consentGiven?: boolean;
}

/** Registration doesn't create the account — it sends an OTP and returns its id. */
export interface RegisterResult {
  ok: boolean;
  message: string;
  otpId: string;
}

/** Every auth call the backend exposes (modules/system/auth/auth.controller.ts). */
export const authApi = {
  login: (payload: LoginPayload) => http.post<Session>('/auth/login', payload),

  register: (payload: RegisterPayload) => http.post<RegisterResult>('/auth/register', payload),

  /** Confirming the OTP is what creates the account, and it signs the user straight in. */
  verifyEmail: (payload: { email: string; otp: string }) => http.post<Session>('/auth/verify-email', payload),

  resendVerification: (email: string) => http.post<{ ok: boolean; message: string }>('/auth/resend-verification', { email }),

  me: () => http.get<AuthUser>('/auth/me'),

  logout: (refreshToken: string) => http.post<unknown>('/auth/logout', { refreshToken }),

  logoutAll: () => http.post<unknown>('/auth/logout-all'),

  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    http.post<unknown>('/auth/change-password', payload),

  setPassword: (newPassword: string) => http.post<unknown>('/auth/set-password', { newPassword }),

  forgotPassword: (email: string) => http.post<{ ok: boolean; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (payload: { token: string; newPassword: string }) => http.post<unknown>('/auth/reset-password', payload),

  /** OTP reset works off either the email or the mobile on the account. */
  forgotPasswordOtp: (identifier: string) =>
    http.post<{ ok: boolean; message: string }>('/auth/forgot-password-otp', { identifier }),

  resetPasswordOtp: (payload: { identifier: string; otp: string; newPassword: string }) =>
    http.post<unknown>('/auth/reset-password-otp', payload),

  requestEmailChange: (newEmail: string) => http.post<unknown>('/auth/change-email/request', { newEmail }),
  confirmEmailChange: (otp: string) => http.post<unknown>('/auth/change-email/confirm', { otp }),
  requestPhoneChange: (newPhone: string) => http.post<unknown>('/auth/change-phone/request', { newPhone }),
  confirmPhoneChange: (otp: string) => http.post<unknown>('/auth/change-phone/confirm', { otp }),
};

/** RBAC — the effective permission set and the catalog behind the permissions matrix. */
export const rbacApi = {
  myPermissions: () => http.get<string[]>('/rbac/me'),
  catalog: () => http.get<Record<string, Array<{ key: string; label: string; roles: string[] }>>>('/rbac/catalog'),
  overrides: () => http.get<Array<{ role: string; permissionKey: string; granted: boolean }>>('/rbac/overrides'),
  setOverride: (payload: { role: string; permissionKey: string; granted: boolean }) =>
    http.post<unknown>('/rbac/overrides', payload),
  clearOverride: (params: { role: string; permissionKey: string }) =>
    http.delete<unknown>('/rbac/overrides', { params }),
};
