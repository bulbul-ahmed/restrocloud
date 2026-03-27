export type CustomerSegment = 'NEW' | 'REGULAR' | 'VIP' | 'DORMANT' | 'AT_RISK'
export type PromoDiscountType = 'FLAT' | 'PERCENT'
export type CampaignChannel = 'EMAIL' | 'SMS' | 'PUSH'
export type CampaignStatus = 'DRAFT' | 'SENT' | 'FAILED'

export interface LoyaltyConfig {
  id?: string
  restaurantId: string
  tenantId: string
  pointsPerSpend: number
  bronzeThreshold: number
  silverThreshold: number
  goldThreshold: number
  platinumThreshold: number
  pointsExpiryDays?: number | null
  isEnabled: boolean
}

export interface CustomerWithSegment {
  id: string
  firstName: string
  lastName?: string | null
  phone?: string | null
  email?: string | null
  dateOfBirth?: string | null
  isBlacklisted: boolean
  segment: CustomerSegment
  totalOrders: number
  lastOrderAt?: string | null
  loyaltyTier?: string | null
  loyaltyPoints: number
  createdAt: string
}

export interface StampCard {
  id: string
  name: string
  description?: string | null
  stampsRequired: number
  rewardDesc: string
  rewardValue?: number | null
  isActive: boolean
}

export interface StampProgress {
  stampCard: StampCard
  stamps: number
  isComplete: boolean
  completedAt?: string | null
  redeemedAt?: string | null
}

export interface PromoCode {
  id: string
  code: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount: number
  maxUses?: number | null
  usedCount: number
  validFrom?: string | null
  validUntil?: string | null
  isActive: boolean
  createdAt: string
}

export interface PromoValidateResult {
  valid: boolean
  promoCodeId?: string
  discountType?: PromoDiscountType
  discountValue?: number
  discountAmount?: number
  reason?: string
}

export interface CampaignBroadcast {
  id: string
  name: string
  channel: CampaignChannel
  segment: CustomerSegment | 'ALL'
  subject?: string | null
  body: string
  sentCount: number
  status: CampaignStatus
  sentAt?: string | null
  createdAt: string
}

export interface Review {
  id: string
  customerId: string
  rating: number
  comment?: string | null
  isApproved: boolean
  createdAt: string
  customer: {
    firstName: string
    lastName?: string | null
    phone?: string | null
  }
}
