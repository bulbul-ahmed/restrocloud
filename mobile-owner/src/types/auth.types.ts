export interface MobileUser {
  id: string
  tenantId: string
  restaurantId: string | null
  firstName: string
  lastName: string
  email: string
  role: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}
