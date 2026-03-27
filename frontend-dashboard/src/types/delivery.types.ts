export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED'

export interface DeliveryZone {
  id: string
  tenantId: string
  restaurantId: string
  name: string
  radiusKm: number
  extraFee: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Driver {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  isActive: boolean
  isOnline: boolean
  createdAt: string
}

export interface DeliveryAddress {
  line1?: string
  line2?: string
  city?: string
  area?: string
  lat?: number
  lng?: number
}

export interface Delivery {
  id: string
  tenantId: string
  restaurantId: string
  orderId: string
  driverId: string | null
  zoneId: string | null
  status: DeliveryStatus
  proofUrl: string | null
  proofNotes: string | null
  estimatedAt: string | null
  assignedAt: string | null
  pickedUpAt: string | null
  inTransitAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  failReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  order?: {
    orderNumber: string
    totalAmount: string
    deliveryAddress: DeliveryAddress | null
    channel: string
  }
  driver?: {
    id: string
    firstName: string
    lastName: string
    phone?: string | null
  } | null
  zone?: {
    id: string
    name: string
  } | null
}

export interface DeliveryLocation {
  isOnline: boolean
  lastLocation: {
    lat: number
    lng: number
    bearing?: number
    timestamp: string
    deliveryId: string
  } | null
}

export interface DeliveryAnalytics {
  deliveriesByStatus: { status: DeliveryStatus; count: number }[]
  avgDeliveryMinutes: number
  successRatePercent: number
  driverLeaderboard: { driverId: string; name: string; deliveries: number }[]
  zoneCoverage: { zoneId: string | null; zoneName: string; count: number }[]
}

export interface DeliveryPage {
  data: Delivery[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

// DTOs
export interface CreateZoneDto {
  name: string
  radiusKm: number
  extraFee?: number
}

export interface UpdateZoneDto {
  name?: string
  radiusKm?: number
  extraFee?: number
  isActive?: boolean
}

export interface CreateDriverDto {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
}

export interface CreateDeliveryDto {
  orderId: string
  driverId?: string
  zoneId?: string
  estimatedAt?: string
  notes?: string
}

export interface AssignDriverDto {
  driverId: string
  estimatedAt?: string
}

export interface UpdateDeliveryStatusDto {
  status: DeliveryStatus
  failReason?: string
  notes?: string
}

export interface ListDeliveriesQuery {
  status?: DeliveryStatus | ''
  driverId?: string
  date?: string
  page?: number
  limit?: number
}

export interface DeliveryAnalyticsQuery {
  dateFrom?: string
  dateTo?: string
}
