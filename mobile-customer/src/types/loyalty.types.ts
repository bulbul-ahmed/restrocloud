export interface LoyaltyTier {
  name: string
  minPoints: number
  discountPercent: number
}

export interface LoyaltyHistory {
  id: string
  points: number
  type: 'EARNED' | 'REDEEMED'
  reason?: string | null
  createdAt: string
}

export interface LoyaltyDashboard {
  points: number
  redeemablePoints: number
  tier?: LoyaltyTier | null
  history: LoyaltyHistory[]
}

export interface Address {
  id: string
  street: string
  city: string
  postalCode?: string | null
  country?: string | null
  isDefault: boolean
}

export interface CustomerNotification {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}
