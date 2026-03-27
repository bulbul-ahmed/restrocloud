// ─── Enums ───────────────────────────────────────────────────────────────────

export type PlanTier = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE'

// ─── Platform KPIs ────────────────────────────────────────────────────────────

export interface PlatformKpis {
  tenants: {
    total: number
    active: number
    suspended: number
    newThisMonth: number
  }
  restaurants: { total: number }
  users: { total: number }
  orders: {
    today: number
    allTimeRevenue: number
    todayRevenue: number
  }
  growth: {
    churnedThisMonth: number
    churnedLastMonth: number
    convertedThisMonth: number
    activeUsersNow: number
  }
}

// ─── System Health ────────────────────────────────────────────────────────────

export interface HealthCheck {
  status: 'healthy' | 'unhealthy'
  latencyMs?: number
  error?: string
}

export interface SystemHealth {
  status: 'healthy' | 'degraded'
  checks: {
    database: HealthCheck
    redis: HealthCheck
  }
  counts: { tenants: number; restaurants: number; users: number }
  timestamp: string
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export interface TenantRestaurant {
  id: string
  name: string
  isActive: boolean
}

export interface TenantRow {
  id: string
  name: string
  slug: string
  plan: PlanTier
  isActive: boolean
  trialEndsAt: string | null
  creditBalance: number
  flaggedForReview: boolean
  flagReason: string | null
  terminatedAt: string | null
  accountManagerId: string | null
  createdAt: string
  restaurantCount: number
  userCount: number
  restaurants: TenantRestaurant[]
}

export interface TenantNote {
  id: string
  tenantId: string
  content: string
  authorId: string
  authorEmail: string
  createdAt: string
}

export interface TenantDetailRestaurant {
  id: string
  name: string
  slug: string
  isActive: boolean
  currency: string
  timezone: string
  createdAt: string
  brandColor?: string | null
}

export interface TenantDetailUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface TenantDetail extends TenantRow {
  restaurants: TenantDetailRestaurant[]
  users: TenantDetailUser[]
  stats: {
    totalRevenue: number
    totalOrders: number
    lastOrderAt: string | null
  }
}

export interface Pagination {
  total: number
  page: number
  limit: number
  pages: number
}

export interface TenantsResponse {
  data: TenantRow[]
  pagination: Pagination
}

// ─── Platform Revenue ─────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
  activeTenants: number
}

export interface PlatformRevenue {
  groupBy: 'day' | 'week' | 'month'
  dateFrom: string
  dateTo: string
  summary: {
    totalRevenue: number
    totalOrders: number
  }
  data: RevenueDataPoint[]
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  action: string
  actorId: string
  actorEmail: string
  targetId: string
  targetName: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export interface AuditLogResponse {
  data: AuditEntry[]
  pagination: Pagination
}

// ─── Super Admin Users ────────────────────────────────────────────────────────

export type SARole =
  | 'PLATFORM_OWNER'
  | 'SUPER_ADMIN'
  | 'FINANCE_ADMIN'
  | 'SUPPORT_MANAGER'
  | 'SUPPORT_AGENT'
  | 'ENGINEERING_ADMIN'

export const SA_ROLES: SARole[] = [
  'PLATFORM_OWNER',
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
  'SUPPORT_MANAGER',
  'SUPPORT_AGENT',
  'ENGINEERING_ADMIN',
]

export interface SuperAdminUserRow {
  id: string
  firstName: string
  lastName: string
  email: string
  role: SARole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export interface PlanBreakdownItem {
  plan: string
  count: number
  monthlyPrice: number
  mrr: number
}

export interface FinanceOverview {
  mrr: number
  arr: number
  totalActiveSubscribers: number
  planBreakdown: PlanBreakdownItem[]
  gmv: {
    thisMonth: number
    lastMonth: number
    ytd: number
    momChangePercent: number | null
  }
  signups: { thisMonth: number }
  churn: { thisMonth: number }
}

export interface FinancePlanRow {
  plan: string
  tenantCount: number
  gmv: number
  orderCount: number
}

export interface OutstandingTenant {
  id: string
  name: string
  slug: string
  plan: string
  trialEndsAt?: string | null
  createdAt: string
  restaurantCount: number
  daysSinceExpiry?: number
  flagReason?: string | null
  updatedAt?: string
}

export interface OutstandingAccounts {
  trialExpired: OutstandingTenant[]
  suspended: OutstandingTenant[]
  flagged: OutstandingTenant[]
  summary: {
    trialExpiredCount: number
    suspendedCount: number
    flaggedCount: number
  }
}

export interface SaRefund {
  id: string
  tenantId: string
  tenant: { name: string; slug: string } | null
  paymentId: string
  orderId: string
  restaurantId: string
  restaurant: { name: string; slug: string } | null
  amount: number
  currency: string
  reason: string | null
  status: string
  gatewayRefId: string | null
  processedAt: string | null
  createdAt: string
}

export interface SaRefundsResponse {
  data: SaRefund[]
  pagination: Pagination
}

export interface TaxReportRow {
  country: string
  tenantCount: number
  orderCount: number
  totalTax: number
  totalGmv: number
  effectiveTaxRate: number
}

export interface TaxReport {
  year: number
  grandTotalTax: number
  grandTotalGmv: number
  rows: TaxReportRow[]
}

export interface GmvTrendPoint {
  month: string
  gmv: number
  orders: number
  tenants: number
}

// ─── Platform Users ───────────────────────────────────────────────────────────

export interface PlatformUser {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: string
  isActive: boolean
  isVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  tenantId: string
  restaurantId: string | null
  tenant: { name: string; slug: string; plan: string } | null
  restaurant: { name: string; slug: string } | null
}

export interface PlatformUsersResponse {
  data: PlatformUser[]
  pagination: Pagination
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface TicketMessage {
  id: string
  ticketId: string
  authorId: string
  authorEmail: string
  isStaff: boolean
  content: string
  createdAt: string
}

export interface SupportTicket {
  id: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  tenantId: string | null
  submittedBy: string
  assignedTo: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  tenant?: { name: string; slug: string } | null
  messages?: TicketMessage[]
  _count?: { messages: number }
}

export interface TicketStats {
  total: number
  byStatus: { status: TicketStatus; _count: number }[]
  byPriority: { priority: TicketPriority; _count: number }[]
}

export interface Announcement {
  id: string
  title: string
  body: string
  authorId: string
  authorEmail: string
  scheduledFor: string | null
  createdAt: string
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

export type BroadcastSegment = 'ALL' | 'ACTIVE' | 'TRIAL' | 'PAID' | 'SUSPENDED'

export interface Broadcast {
  id: string
  subject: string
  body: string
  segment: BroadcastSegment
  sentCount: number
  sentBy: string
  sentByEmail: string
  createdAt: string
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string
  enabled: boolean
  description: string
  updatedAt: string
}

export interface TenantFeatureOverride {
  key: string
  enabled: boolean
  updatedAt: string
}

// ─── Manual Restaurant Creation ───────────────────────────────────────────────

export interface CreateRestaurantPayload {
  // Owner
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
  ownerPhone?: string
  // Restaurant
  restaurantName: string
  country: string
  city?: string
  address?: string
  restaurantPhone?: string
  restaurantEmail?: string
  // Plan
  plan: PlanTier
  trialDays: number
  // SA-only
  internalNotes?: string
  sendWelcomeEmail: boolean
}

export interface CreateRestaurantResult {
  tenantId: string
  restaurantId: string
  userId: string
  tempPassword: string
  plan: PlanTier
  trialEndsAt: string | null
  welcomeEmailSent: boolean
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export interface KbArticle {
  id: string
  title: string
  slug: string
  body: string
  category: string
  isPublished: boolean
  authorId: string
  authorEmail: string
  createdAt: string
  updatedAt: string
}

export interface CreateKbArticlePayload {
  title: string
  slug?: string
  body: string
  category?: string
  isPublished?: boolean
}

export interface UpdateKbArticlePayload {
  title?: string
  body?: string
  category?: string
  isPublished?: boolean
}

// ─── Login History ────────────────────────────────────────────────────────────

export interface LoginHistoryEntry {
  id: string
  userId: string
  ipAddress: string | null
  deviceInfo: string | null
  success: boolean
  createdAt: string
}

// ─── Plan Management ─────────────────────────────────────────────────────────

export interface Plan {
  id: string
  name: string
  tier: PlanTier
  priceMonthly: number
  priceAnnual: number
  currency: string
  maxLocations: number
  maxUsers: number
  features: Record<string, boolean>
  isActive: boolean
  isPublic: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreatePlanPayload {
  tier: PlanTier
  name: string
  priceMonthly: number
  priceAnnual: number
  currency?: string
  maxLocations?: number
  maxUsers?: number
  features?: Record<string, boolean>
  isActive?: boolean
  isPublic?: boolean
  sortOrder?: number
}

export type UpdatePlanPayload = Partial<Omit<CreatePlanPayload, 'tier'>>

// ─── Impersonation ────────────────────────────────────────────────────────────

export interface ImpersonateResult {
  accessToken: string
  tokenType: string
  expiresIn: string
  impersonating: {
    tenantId: string
    tenantName: string
    restaurantId: string
    restaurantName: string
    userId: string
    userEmail: string
  }
}
