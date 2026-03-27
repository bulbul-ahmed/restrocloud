import { api } from './api'
import type {
  PlatformKpis,
  SystemHealth,
  TenantsResponse,
  TenantDetail,
  TenantNote,
  PlatformRevenue,
  AuditLogResponse,
  SuperAdminUserRow,
  ImpersonateResult,
  PlanTier,
  FinanceOverview,
  FinancePlanRow,
  OutstandingAccounts,
  GmvTrendPoint,
  SaRefundsResponse,
  TaxReport,
  FeatureFlag,
  TenantFeatureOverride,
  PlatformUser,
  PlatformUsersResponse,
  SupportTicket,
  TicketMessage,
  TicketStats,
  TicketStatus,
  TicketPriority,
  Announcement,
  Broadcast,
  BroadcastSegment,
  CreateRestaurantPayload,
  CreateRestaurantResult,
  Plan,
  CreatePlanPayload,
  UpdatePlanPayload,
  LoginHistoryEntry,
  KbArticle,
  CreateKbArticlePayload,
  UpdateKbArticlePayload,
} from '@/types/superadmin.types'

// Helper: unwrap the { success, data } envelope
function unwrap<T>(envelope: { success: boolean; data: T }): T {
  return envelope.data
}

// ─── Platform ─────────────────────────────────────────────────────────────────

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const { data } = await api.get<{ success: boolean; data: PlatformKpis }>('/super-admin/platform/kpis')
  return unwrap(data)
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const { data } = await api.get<{ success: boolean; data: SystemHealth }>('/super-admin/health')
  return unwrap(data)
}

export async function getPlatformRevenue(params: {
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month'
}): Promise<PlatformRevenue> {
  const { data } = await api.get<{ success: boolean; data: PlatformRevenue }>(
    '/super-admin/platform/revenue',
    { params },
  )
  return unwrap(data)
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function createRestaurantManual(
  payload: CreateRestaurantPayload,
): Promise<CreateRestaurantResult> {
  const { data } = await api.post<{ success: boolean; data: CreateRestaurantResult }>(
    '/super-admin/tenants',
    payload,
  )
  return unwrap(data)
}

export async function listTenants(params: {
  search?: string
  plan?: PlanTier
  isActive?: boolean
  page?: number
  limit?: number
}): Promise<TenantsResponse> {
  const { data } = await api.get<{ success: boolean; data: TenantsResponse }>(
    '/super-admin/tenants',
    { params },
  )
  return unwrap(data)
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail> {
  const { data } = await api.get<{ success: boolean; data: TenantDetail }>(
    `/super-admin/tenants/${tenantId}`,
  )
  return unwrap(data)
}

export async function suspendTenant(tenantId: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/suspend`)
}

export async function activateTenant(tenantId: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/activate`)
}

export async function updateTenantPlan(tenantId: string, plan: PlanTier): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/plan`, { plan })
}

export async function impersonateTenant(
  tenantId: string,
  restaurantId: string,
): Promise<ImpersonateResult> {
  const { data } = await api.post<{ success: boolean; data: ImpersonateResult }>(
    `/super-admin/tenants/${tenantId}/impersonate`,
    { restaurantId },
  )
  return unwrap(data)
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function getAuditLog(page = 1, limit = 50): Promise<AuditLogResponse> {
  const { data } = await api.get<{ success: boolean; data: AuditLogResponse }>(
    '/super-admin/audit-log',
    { params: { page, limit } },
  )
  return unwrap(data)
}

// ─── Super Admin Users ────────────────────────────────────────────────────────

export async function listSuperAdmins(): Promise<SuperAdminUserRow[]> {
  const { data } = await api.get<{ success: boolean; data: SuperAdminUserRow[] }>(
    '/super-admin/users',
  )
  return unwrap(data)
}

export async function createSuperAdmin(dto: {
  firstName: string
  lastName: string
  email: string
  password: string
  role?: string
}): Promise<SuperAdminUserRow> {
  const { data } = await api.post<{ success: boolean; data: SuperAdminUserRow }>(
    '/super-admin/users',
    dto,
  )
  return unwrap(data)
}

export async function deactivateSuperAdmin(userId: string): Promise<void> {
  await api.patch(`/super-admin/users/${userId}/deactivate`)
}

// ─── SA-A Tenant Extended Actions ────────────────────────────────────────────

export async function applyCredit(tenantId: string, amount: number, reason?: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/credit`, { amount, reason })
}

export async function extendTrial(tenantId: string, days: number): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/extend-trial`, { days })
}

export async function terminateTenant(tenantId: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/terminate`)
}

export async function updateRestaurantBrand(tenantId: string, restaurantId: string, brandColor: string): Promise<{ id: string; name: string; brandColor: string }> {
  const { data } = await api.patch<{ success: boolean; data: { id: string; name: string; brandColor: string } }>(
    `/super-admin/tenants/${tenantId}/restaurants/${restaurantId}/brand`,
    { brandColor },
  )
  return unwrap(data)
}

export async function sendPasswordReset(tenantId: string, userId: string): Promise<{ message: string }> {
  const { data } = await api.post<{ success: boolean; data: { message: string } }>(
    `/super-admin/tenants/${tenantId}/users/${userId}/send-password-reset`,
  )
  return unwrap(data)
}

export async function flagTenant(tenantId: string, reason?: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/flag`, { reason })
}

export async function unflagTenant(tenantId: string): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/unflag`)
}

export async function listNotes(tenantId: string): Promise<TenantNote[]> {
  const { data } = await api.get<{ success: boolean; data: TenantNote[] }>(
    `/super-admin/tenants/${tenantId}/notes`,
  )
  return unwrap(data)
}

export async function createNote(tenantId: string, content: string): Promise<TenantNote> {
  const { data } = await api.post<{ success: boolean; data: TenantNote }>(
    `/super-admin/tenants/${tenantId}/notes`,
    { content },
  )
  return unwrap(data)
}

export async function deleteNote(tenantId: string, noteId: string): Promise<void> {
  await api.delete(`/super-admin/tenants/${tenantId}/notes/${noteId}`)
}

export async function assignManager(tenantId: string, managerId: string | null): Promise<void> {
  await api.patch(`/super-admin/tenants/${tenantId}/assign-manager`, { managerId })
}

// ─── SA-B Finance ─────────────────────────────────────────────────────────────

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const { data } = await api.get<{ success: boolean; data: FinanceOverview }>('/super-admin/finance/overview')
  return unwrap(data)
}

export async function getFinancePlanBreakdown(params?: { dateFrom?: string; dateTo?: string }): Promise<FinancePlanRow[]> {
  const { data } = await api.get<{ success: boolean; data: FinancePlanRow[] }>(
    '/super-admin/finance/plan-breakdown',
    { params },
  )
  return unwrap(data)
}

export async function getOutstandingAccounts(): Promise<OutstandingAccounts> {
  const { data } = await api.get<{ success: boolean; data: OutstandingAccounts }>('/super-admin/finance/outstanding')
  return unwrap(data)
}

export async function getGmvTrend(): Promise<GmvTrendPoint[]> {
  const { data } = await api.get<{ success: boolean; data: GmvTrendPoint[] }>('/super-admin/finance/gmv-trend')
  return unwrap(data)
}

export async function listSaRefunds(params?: {
  status?: string
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}): Promise<SaRefundsResponse> {
  const { data } = await api.get<{ success: boolean; data: SaRefundsResponse }>('/super-admin/finance/refunds', { params })
  return unwrap(data)
}

export async function getTaxReport(year?: number): Promise<TaxReport> {
  const { data } = await api.get<{ success: boolean; data: TaxReport }>('/super-admin/finance/tax-report', { params: year ? { year } : undefined })
  return unwrap(data)
}

// ─── SA-C Feature Flags ───────────────────────────────────────────────────────

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data } = await api.get<{ success: boolean; data: FeatureFlag[] }>('/super-admin/feature-flags')
  return unwrap(data)
}

export async function setFeatureFlag(payload: { key: string; enabled: boolean; description?: string }): Promise<FeatureFlag> {
  const { data } = await api.post<{ success: boolean; data: FeatureFlag }>('/super-admin/feature-flags', payload)
  return unwrap(data)
}

export async function deleteFeatureFlag(key: string): Promise<void> {
  await api.delete(`/super-admin/feature-flags/${key}`)
}

export async function getTenantFeatureOverrides(tenantId: string): Promise<TenantFeatureOverride[]> {
  const { data } = await api.get<{ success: boolean; data: TenantFeatureOverride[] }>(`/super-admin/feature-flags/tenant/${tenantId}`)
  return unwrap(data)
}

export async function setTenantFeatureOverride(tenantId: string, payload: { key: string; enabled: boolean }): Promise<TenantFeatureOverride> {
  const { data } = await api.post<{ success: boolean; data: TenantFeatureOverride }>(`/super-admin/feature-flags/tenant/${tenantId}`, payload)
  return unwrap(data)
}

export async function deleteTenantFeatureOverride(tenantId: string, key: string): Promise<void> {
  await api.delete(`/super-admin/feature-flags/tenant/${tenantId}/${key}`)
}

// ─── SA-F Platform Users ──────────────────────────────────────────────────────

export async function listPlatformUsers(params?: {
  search?: string; role?: string; isActive?: boolean; tenantId?: string; page?: number; limit?: number
}): Promise<PlatformUsersResponse> {
  const { data } = await api.get<{ success: boolean; data: PlatformUsersResponse }>('/super-admin/platform-users', { params })
  return unwrap(data)
}

export async function getPlatformUser(userId: string): Promise<PlatformUser> {
  const { data } = await api.get<{ success: boolean; data: PlatformUser }>(`/super-admin/platform-users/${userId}`)
  return unwrap(data)
}

export async function resetUserPassword(userId: string): Promise<{ tempPassword: string; message: string }> {
  const { data } = await api.post<{ success: boolean; data: { tempPassword: string; message: string } }>(`/super-admin/platform-users/${userId}/reset-password`)
  return unwrap(data)
}

export async function unlockUser(userId: string): Promise<{ message: string }> {
  const { data } = await api.patch<{ success: boolean; data: { message: string } }>(`/super-admin/platform-users/${userId}/unlock`)
  return unwrap(data)
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export async function listKbArticles(category?: string): Promise<KbArticle[]> {
  const { data } = await api.get<{ success: boolean; data: KbArticle[] }>('/super-admin/kb', { params: category ? { category } : undefined })
  return unwrap(data)
}

export async function getKbArticle(slug: string): Promise<KbArticle> {
  const { data } = await api.get<{ success: boolean; data: KbArticle }>(`/super-admin/kb/${slug}`)
  return unwrap(data)
}

export async function createKbArticle(payload: CreateKbArticlePayload): Promise<KbArticle> {
  const { data } = await api.post<{ success: boolean; data: KbArticle }>('/super-admin/kb', payload)
  return unwrap(data)
}

export async function updateKbArticle(slug: string, payload: UpdateKbArticlePayload): Promise<KbArticle> {
  const { data } = await api.patch<{ success: boolean; data: KbArticle }>(`/super-admin/kb/${slug}`, payload)
  return unwrap(data)
}

export async function deleteKbArticle(slug: string): Promise<void> {
  await api.delete(`/super-admin/kb/${slug}`)
}

// ─── Login History ────────────────────────────────────────────────────────────

export async function getUserLoginHistory(userId: string, page = 1, limit = 50) {
  const { data } = await api.get<{ success: boolean; data: { data: LoginHistoryEntry[]; pagination: { total: number; page: number; limit: number; pages: number } } }>(
    `/super-admin/platform-users/${userId}/login-history`,
    { params: { page, limit } },
  )
  return unwrap(data)
}

// ─── SA-D Support Tickets ─────────────────────────────────────────────────────

export async function getTicketStats(): Promise<TicketStats> {
  const { data } = await api.get<{ success: boolean; data: TicketStats }>('/super-admin/tickets/stats')
  return unwrap(data)
}

export async function listTickets(params?: { status?: TicketStatus; priority?: TicketPriority; tenantId?: string; page?: number; limit?: number }) {
  const { data } = await api.get<{ success: boolean; data: { data: SupportTicket[]; pagination: { total: number; page: number; limit: number; pages: number } } }>('/super-admin/tickets', { params })
  return unwrap(data)
}

export async function createTicket(payload: { subject: string; description: string; tenantId?: string; priority?: TicketPriority }): Promise<SupportTicket> {
  const { data } = await api.post<{ success: boolean; data: SupportTicket }>('/super-admin/tickets', payload)
  return unwrap(data)
}

export async function getTicket(ticketId: string): Promise<SupportTicket> {
  const { data } = await api.get<{ success: boolean; data: SupportTicket }>(`/super-admin/tickets/${ticketId}`)
  return unwrap(data)
}

export async function updateTicket(ticketId: string, payload: { status?: TicketStatus; priority?: TicketPriority; assignedTo?: string | null }): Promise<SupportTicket> {
  const { data } = await api.patch<{ success: boolean; data: SupportTicket }>(`/super-admin/tickets/${ticketId}`, payload)
  return unwrap(data)
}

export async function addTicketMessage(ticketId: string, content: string): Promise<TicketMessage> {
  const { data } = await api.post<{ success: boolean; data: TicketMessage }>(`/super-admin/tickets/${ticketId}/messages`, { content })
  return unwrap(data)
}

// ─── SA-D Announcements ───────────────────────────────────────────────────────

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ success: boolean; data: Announcement[] }>('/super-admin/announcements')
  return unwrap(data)
}

export async function createAnnouncement(payload: { title: string; body: string }): Promise<Announcement> {
  const { data } = await api.post<{ success: boolean; data: Announcement }>('/super-admin/announcements', payload)
  return unwrap(data)
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await api.delete(`/super-admin/announcements/${announcementId}`)
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

export async function listBroadcasts(): Promise<Broadcast[]> {
  const { data } = await api.get<{ success: boolean; data: Broadcast[] }>('/super-admin/broadcasts')
  return unwrap(data)
}

export async function sendBroadcast(payload: {
  subject: string
  body: string
  segment?: BroadcastSegment
}): Promise<Broadcast> {
  const { data } = await api.post<{ success: boolean; data: Broadcast }>('/super-admin/broadcasts', payload)
  return unwrap(data)
}

// ─── Plan Management ──────────────────────────────────────────────────────────

export async function listPlans(): Promise<Plan[]> {
  const { data } = await api.get<{ success: boolean; data: Plan[] }>('/super-admin/plans')
  return unwrap(data)
}

export async function createPlan(payload: CreatePlanPayload): Promise<Plan> {
  const { data } = await api.post<{ success: boolean; data: Plan }>('/super-admin/plans', payload)
  return unwrap(data)
}

export async function updatePlan(tier: string, payload: UpdatePlanPayload): Promise<Plan> {
  const { data } = await api.patch<{ success: boolean; data: Plan }>(`/super-admin/plans/${tier}`, payload)
  return unwrap(data)
}

export async function deletePlan(tier: string): Promise<void> {
  await api.delete(`/super-admin/plans/${tier}`)
}
