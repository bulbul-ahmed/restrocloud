// M2 — Restaurant Settings types

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QR' | 'ONLINE'

export interface DayHours {
  closed: boolean
  open?: string   // 'HH:MM'
  close?: string  // 'HH:MM'
}

export interface OperatingHours {
  regularHours?: {
    mon?: DayHours
    tue?: DayHours
    wed?: DayHours
    thu?: DayHours
    fri?: DayHours
    sat?: DayHours
    sun?: DayHours
  }
  holidayOverrides?: Record<string, { closed: boolean; note?: string; open?: string; close?: string }>
}

export interface TipOptions {
  tipPercentages: number[]
  allowCustom: boolean
}

export interface ReceiptConfig {
  header?: string
  footer?: string
  showLogo?: boolean
  showTaxBreakdown?: boolean
  showWifi?: boolean
  wifiPassword?: string
}

export interface AutoAcceptConfig {
  pos?: boolean
  qr?: boolean
  online?: boolean
  aggregator?: boolean
}

export interface AutoAcceptTimerConfig {
  autoAccept: AutoAcceptConfig | null
  autoAcceptMinutes: { pos: number; qr: number; online: number; aggregator?: number }
}

export interface PaymentGatewayConfig {
  id: string
  gateway: string
  apiKey: string | null
  secretKey: string | null
  webhookSecret: string | null
  isLive: boolean
  isActive: boolean
}

export interface RestaurantSettings {
  id: string
  name: string
  description?: string | null
  logoUrl?: string | null
  logoWordmarkUrl?: string | null
  brandColor?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  timezone: string
  locale: string
  currency: string
  taxRate: string | number
  taxInclusive: boolean
  serviceCharge: string | number
  orderTypes: OrderType[]
  operatingHours?: OperatingHours | null
  tipOptions?: TipOptions | null
  receiptConfig?: ReceiptConfig | null
  autoAccept?: AutoAcceptConfig | null
  deliveryFee?: string | number | null
  minimumOrderAmount?: string | number | null
  qrBaseUrl?: string | null
}
