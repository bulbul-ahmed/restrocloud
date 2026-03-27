export interface CustomerUser {
  id: string
  customerId: string
  restaurantId: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
}

export interface AuthResponse {
  accessToken: string
  customer: {
    id: string
    firstName: string
    lastName?: string | null
    email: string
    phone?: string | null
  }
}
