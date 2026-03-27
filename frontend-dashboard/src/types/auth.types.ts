export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'CHEF' | 'SUPERADMIN'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  tenantId: string
  restaurantId?: string
  emailVerified: boolean
  phone?: string
  avatar?: string
  pinSet?: boolean
  twoFactorEnabled?: boolean
}

// Tokens returned by login / 2fa-verify / pin-login
export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType?: string
}

export interface TwoFactorPendingResponse {
  requiresTwoFactor: true
  pendingToken: string
}

export type LoginResponse = TokenResponse | TwoFactorPendingResponse

export function isTwoFactorPending(res: LoginResponse): res is TwoFactorPendingResponse {
  return (res as TwoFactorPendingResponse).requiresTwoFactor === true
}

// ─── Request payloads ────────────────────────────────────────────────────────

export interface LoginPayload {
  identifier: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
  restaurantName: string
  country?: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  password: string
}

export interface PinLoginPayload {
  restaurantId: string
  pin: string
}

export interface Verify2FAPayload {
  pendingToken: string
  code: string
}
