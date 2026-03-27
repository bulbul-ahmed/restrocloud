import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdminService } from './super-admin.service';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanConfigDto } from './dto/update-plan-config.dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { PlatformRevenueQueryDto } from './dto/platform-revenue-query.dto';
import { ApplyCreditDto } from './dto/apply-credit.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { FlagTenantDto } from './dto/flag-tenant.dto';
import { CreateTenantNoteDto } from './dto/create-tenant-note.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { SetFeatureFlagDto } from './dto/set-feature-flag.dto';
import { SetTenantFeatureFlagDto } from './dto/set-tenant-feature-flag.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListPlatformUsersQueryDto } from './dto/list-platform-users-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';
import { GdprDeleteUserDto } from './dto/gdpr-delete-user.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { CreateBannerDto } from './dto/create-banner.dto';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('super-admin')
export class SuperAdminController implements OnModuleInit {
  constructor(private readonly service: SuperAdminService) {}

  async onModuleInit() {
    await this.service.seedDefaultPlansIfEmpty();
  }

  // ─── Platform ────────────────────────────────────────────────────────────

  @Get('platform/kpis')
  @ApiOperation({ summary: 'Platform-wide KPIs (tenants, restaurants, revenue, orders)' })
  getPlatformKpis() {
    return this.service.getPlatformKpis();
  }

  @Get('platform/revenue')
  @ApiOperation({ summary: 'Platform revenue analytics (grouped by day/week/month)' })
  getPlatformRevenue(@Query() query: PlatformRevenueQueryDto) {
    return this.service.getPlatformRevenue(query);
  }

  @Get('health')
  @ApiOperation({ summary: 'System health — DB and Redis latency + platform counts' })
  getHealth() {
    return this.service.getSystemHealth();
  }

  // ─── Tenants ─────────────────────────────────────────────────────────────

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants with restaurant/user counts' })
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.service.listTenants(query);
  }

  @Post('tenants')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER)
  @ApiOperation({ summary: 'Manually create a restaurant account (field sales / support)' })
  createRestaurant(@Body() dto: CreateRestaurantDto, @CurrentUser() user: any) {
    return this.service.createRestaurant(dto, user.id, user.email);
  }

  @Get('tenants/:tenantId')
  @ApiOperation({ summary: 'Tenant detail with users, restaurants, and revenue stats' })
  getTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.getTenantDetail(tenantId);
  }

  @Patch('tenants/:tenantId/restaurants/:restaurantId/brand')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER)
  @ApiOperation({ summary: 'Update brand color for a tenant restaurant' })
  updateRestaurantBrand(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: { brandColor: string },
  ) {
    return this.service.updateRestaurantBrand(tenantId, restaurantId, dto.brandColor);
  }

  @Patch('tenants/:tenantId/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend tenant — blocks login for all tenant users' })
  suspendTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.suspendTenant(tenantId, user.id, user.email);
  }

  @Patch('tenants/:tenantId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-activate a suspended tenant' })
  activateTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.activateTenant(tenantId, user.id, user.email);
  }

  @Patch('tenants/:tenantId/plan')
  @ApiOperation({ summary: "Change tenant's subscription plan" })
  updatePlan(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updatePlan(tenantId, dto, user.id, user.email);
  }

  @Post('tenants/:tenantId/impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue 1-hour impersonation token scoped to a restaurant' })
  impersonate(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: any,
  ) {
    return this.service.impersonate(tenantId, dto, user.id, user.email);
  }

  @Patch('tenants/:tenantId/credit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a credit or debit to tenant balance' })
  applyCredit(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: ApplyCreditDto,
    @CurrentUser() user: any,
  ) {
    return this.service.applyCredit(tenantId, dto, user.id, user.email);
  }

  @Patch('tenants/:tenantId/extend-trial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend trial period for a tenant by N days' })
  extendTrial(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: ExtendTrialDto,
    @CurrentUser() user: any,
  ) {
    return this.service.extendTrial(tenantId, dto, user.id, user.email);
  }

  @Patch('tenants/:tenantId/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently terminate a tenant account (soft delete)' })
  terminateTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.terminateTenant(tenantId, user.id, user.email);
  }

  @Post('tenants/:tenantId/users/:userId/send-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset email to a specific tenant user (SUPER_ADMIN only)' })
  sendPasswordReset(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.sendPasswordResetForUser(tenantId, userId, user.id, user.email);
  }

  @Patch('tenants/:tenantId/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag tenant for review' })
  flagTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: FlagTenantDto,
    @CurrentUser() user: any,
  ) {
    return this.service.flagTenant(tenantId, dto, user.id, user.email);
  }

  @Patch('tenants/:tenantId/unflag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove review flag from tenant' })
  unflagTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unflagTenant(tenantId, user.id, user.email);
  }

  @Post('tenants/:tenantId/notes')
  @ApiOperation({ summary: 'Add an internal note to a tenant' })
  createNote(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateTenantNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createNote(tenantId, dto, user.id, user.email);
  }

  @Get('tenants/:tenantId/notes')
  @ApiOperation({ summary: 'List all internal notes for a tenant' })
  listNotes(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.listNotes(tenantId);
  }

  @Delete('tenants/:tenantId/notes/:noteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an internal note' })
  deleteNote(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteNote(tenantId, noteId, user.id, user.email);
  }

  @Patch('tenants/:tenantId/assign-manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign (or unassign) an account manager to a tenant' })
  assignManager(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: any,
  ) {
    return this.service.assignManager(tenantId, dto, user.id, user.email);
  }

  // ─── Finance ─────────────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/overview')
  @ApiOperation({ summary: 'MRR, ARR, GMV this month, plan distribution' })
  getFinanceOverview() {
    return this.service.getFinanceOverview();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/plan-breakdown')
  @ApiOperation({ summary: 'Tenant count and GMV per plan tier for a date range' })
  getFinancePlanBreakdown(@Query() query: FinanceQueryDto) {
    return this.service.getFinancePlanBreakdown(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/outstanding')
  @ApiOperation({ summary: 'Trial-expired, suspended, and flagged tenants requiring attention' })
  getOutstandingAccounts() {
    return this.service.getOutstandingAccounts();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/gmv-trend')
  @ApiOperation({ summary: 'Monthly GMV trend for last 12 months' })
  getGmvTrend() {
    return this.service.getGmvTrend();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/refunds')
  @ApiOperation({ summary: 'Cross-tenant refund list' })
  listSaRefunds(
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listSaRefunds({
      status,
      tenantId,
      dateFrom,
      dateTo,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('finance/tax-report')
  @ApiOperation({ summary: 'Tax totals grouped by country for a given year' })
  getTaxReport(@Query('year') year?: string) {
    return this.service.getTaxReport(year ? Number(year) : undefined);
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Platform audit log (last 500 events)' })
  getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAuditLog(page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  // ─── Super Admin Users ───────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all super admin users' })
  listSuperAdmins() {
    return this.service.listSuperAdmins();
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new super admin user' })
  createSuperAdmin(@Body() dto: CreateSuperAdminDto, @CurrentUser() user: any) {
    return this.service.createSuperAdmin(dto, user.id, user.email);
  }

  @Patch('users/:userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a super admin user' })
  deactivateSuperAdmin(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deactivateSuperAdmin(userId, user.id, user.email);
  }

  // ─── Feature Flags ───────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Get('feature-flags')
  @ApiOperation({ summary: 'List all global feature flags' })
  listFeatureFlags() {
    return this.service.listFeatureFlags();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Post('feature-flags')
  @ApiOperation({ summary: 'Create or update a global feature flag' })
  setFeatureFlag(@Body() dto: SetFeatureFlagDto, @CurrentUser() user: any) {
    return this.service.setFeatureFlag(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Delete('feature-flags/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a global feature flag' })
  deleteFeatureFlag(@Param('key') key: string, @CurrentUser() user: any) {
    return this.service.deleteFeatureFlag(key, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Get('feature-flags/tenant/:tenantId')
  @ApiOperation({ summary: 'List per-tenant feature flag overrides' })
  getTenantFeatureOverrides(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.getTenantFeatureOverrides(tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Post('feature-flags/tenant/:tenantId')
  @ApiOperation({ summary: 'Set a per-tenant feature flag override' })
  setTenantFeatureOverride(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetTenantFeatureFlagDto,
    @CurrentUser() user: any,
  ) {
    return this.service.setTenantFeatureOverride(tenantId, dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Delete('feature-flags/tenant/:tenantId/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a per-tenant feature flag override' })
  deleteTenantFeatureOverride(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('key') key: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteTenantFeatureOverride(tenantId, key, user.id, user.email);
  }

  // ─── Support Tickets ─────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('tickets/stats')
  @ApiOperation({ summary: 'Ticket counts by status and priority' })
  getTicketStats() {
    return this.service.getTicketStats();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets with optional filters' })
  listTickets(@Query() query: ListTicketsQueryDto) {
    return this.service.listTickets(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.service.createTicket(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'Get ticket detail with messages' })
  getTicket(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.service.getTicket(ticketId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Patch('tickets/:ticketId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update ticket status, priority, or assignment' })
  updateTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateTicket(ticketId, dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Post('tickets/:ticketId/messages')
  @ApiOperation({ summary: 'Add a staff reply to a ticket' })
  addTicketMessage(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: AddTicketMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addTicketMessage(ticketId, dto, user.id, user.email);
  }

  // ─── Announcements ───────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('announcements')
  @ApiOperation({ summary: 'List recent system announcements' })
  listAnnouncements() {
    return this.service.listAnnouncements();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Post('announcements')
  @ApiOperation({ summary: 'Create a new system-wide announcement' })
  createAnnouncement(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: any) {
    return this.service.createAnnouncement(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Delete('announcements/:announcementId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an announcement' })
  deleteAnnouncement(
    @Param('announcementId', ParseUUIDPipe) announcementId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteAnnouncement(announcementId, user.id, user.email);
  }

  // ─── G.5 Knowledge Base ──────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('kb')
  @ApiOperation({ summary: 'List all KB articles (SA view — includes drafts)' })
  listKbArticles(@Query('category') category?: string) {
    return this.service.listKbArticles({ category });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('kb/:slug')
  @ApiOperation({ summary: 'Get a KB article by slug' })
  getKbArticle(@Param('slug') slug: string) {
    return this.service.getKbArticle(slug);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Post('kb')
  @ApiOperation({ summary: 'Create a KB article' })
  createKbArticle(@Body() dto: CreateKbArticleDto, @CurrentUser() user: any) {
    return this.service.createKbArticle(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Patch('kb/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a KB article (title, body, category, isPublished)' })
  updateKbArticle(@Param('slug') slug: string, @Body() dto: UpdateKbArticleDto, @CurrentUser() user: any) {
    return this.service.updateKbArticle(slug, dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Delete('kb/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a KB article' })
  deleteKbArticle(@Param('slug') slug: string, @CurrentUser() user: any) {
    return this.service.deleteKbArticle(slug, user.id, user.email);
  }

  // ─── SA-G Billing ────────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('billing/subscriptions')
  @ApiOperation({ summary: 'List all tenant subscriptions with plan and status' })
  getSubscriptions(
    @Query('plan') plan?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSubscriptions({
      plan: plan as any,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('billing/conversions')
  @ApiOperation({ summary: 'Trial conversion metrics' })
  getTrialConversions() {
    return this.service.getTrialConversions();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('billing/coupons')
  @ApiOperation({ summary: 'List all coupon codes' })
  listCoupons() {
    return this.service.listCoupons();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Post('billing/coupons')
  @ApiOperation({ summary: 'Create a new coupon code' })
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: any) {
    return this.service.createCoupon(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Patch('billing/coupons/:couponId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a coupon' })
  toggleCoupon(@Param('couponId', ParseUUIDPipe) couponId: string, @CurrentUser() user: any) {
    return this.service.toggleCoupon(couponId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Post('billing/coupons/:couponId/apply/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply coupon to a specific tenant' })
  applyCouponToTenant(
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.applyCouponToTenant(couponId, tenantId, user.id, user.email);
  }

  // ─── SA-D Invoices ────────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('billing/invoices')
  @ApiOperation({ summary: 'List all invoices across tenants (filterable)' })
  listSaInvoices(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listSaInvoices({
      tenantId,
      status,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Post('billing/invoices')
  @ApiOperation({ summary: 'Manually create an invoice for a tenant' })
  createSaInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: any) {
    return this.service.createSaInvoice(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Patch('billing/invoices/:invoiceId/mark-paid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  markInvoicePaid(@Param('invoiceId', ParseUUIDPipe) invoiceId: string, @CurrentUser() user: any) {
    return this.service.markInvoicePaid(invoiceId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Patch('billing/invoices/:invoiceId/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an unpaid invoice' })
  voidInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string, @CurrentUser() user: any) {
    return this.service.voidInvoice(invoiceId, user.id, user.email);
  }

  // ─── SA-F Platform Users ──────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('platform-users')
  @ApiOperation({ summary: 'Search all users across all tenants' })
  listPlatformUsers(@Query() query: ListPlatformUsersQueryDto) {
    return this.service.listPlatformUsers(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('platform-users/:userId')
  @ApiOperation({ summary: 'Get user detail with tenant and restaurant' })
  getPlatformUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getPlatformUser(userId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Post('platform-users/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password — returns temp password' })
  resetUserPassword(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.resetUserPassword(userId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Patch('platform-users/:userId/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock / reactivate a deactivated user' })
  unlockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlockUser(userId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Get('platform-users/:userId/login-history')
  @ApiOperation({ summary: 'Get login history for a specific user' })
  getUserLoginHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getUserLoginHistory(userId, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  // ─── SA-I Email Broadcasts ───────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Get('broadcasts')
  @ApiOperation({ summary: 'List sent email broadcasts' })
  listBroadcasts() {
    return this.service.listBroadcasts();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Post('broadcasts')
  @ApiOperation({ summary: 'Send an email broadcast to a tenant segment' })
  sendBroadcast(@Body() dto: SendBroadcastDto, @CurrentUser() user: any) {
    return this.service.sendBroadcast(dto, user.id, user.email);
  }

  // ─── SA-J Analytics Intelligence ─────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('analytics/cohorts')
  @ApiOperation({ summary: 'Cohort retention: sign-up month vs active months heatmap' })
  getCohortRetention() {
    return this.service.getCohortRetention();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Get('analytics/feature-adoption')
  @ApiOperation({ summary: 'Percentage of active tenants using each feature module' })
  getFeatureAdoption() {
    return this.service.getFeatureAdoption();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Get('analytics/at-risk')
  @ApiOperation({ summary: 'At-risk tenants with signals: inactivity, trial expiry, declining orders' })
  getAtRiskTenants() {
    return this.service.getAtRiskTenants();
  }

  // ─── SA-K System Administration ───────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Get('system/errors')
  @ApiOperation({ summary: 'Recent 500 errors logged to Redis (last 200)' })
  getErrorLog(@Query('limit') limit?: string) {
    return this.service.getErrorLog(limit ? Number(limit) : 50);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.ENGINEERING_ADMIN)
  @Get('system/health-detail')
  @ApiOperation({ summary: 'Detailed DB table sizes and Redis memory/hit-rate stats' })
  getSystemHealthDetail() {
    return this.service.getSystemHealthDetail();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER)
  @Post('system/gdpr/delete-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GDPR hard-delete: anonymise customer PII across all records' })
  gdprDeleteUser(@Body() dto: GdprDeleteUserDto, @CurrentUser() user: any) {
    return this.service.gdprDeleteUser(dto.customerEmail, user.id, user.email);
  }

  // ─── SA-L Marketing & Growth ──────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('marketing/stats')
  @ApiOperation({ summary: 'Marketing stats: referral signups, banner count, coupon redemptions' })
  getMarketingStats() {
    return this.service.getMarketingStats();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('marketing/referrals')
  @ApiOperation({ summary: 'List all referral codes' })
  listReferralCodes() {
    return this.service.listReferralCodes();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Post('marketing/referrals')
  @ApiOperation({ summary: 'Create a new referral code' })
  createReferralCode(@Body() dto: CreateReferralCodeDto, @CurrentUser() user: any) {
    return this.service.createReferralCode(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Patch('marketing/referrals/:referralId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a referral code' })
  toggleReferralCode(@Param('referralId', ParseUUIDPipe) referralId: string, @CurrentUser() user: any) {
    return this.service.toggleReferralCode(referralId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Post('marketing/referrals/:code/apply/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a referral code to a tenant' })
  applyReferralCode(
    @Param('code') code: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.applyReferralCode(code, tenantId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Get('marketing/banners')
  @ApiOperation({ summary: 'List all in-app banners' })
  listBanners() {
    return this.service.listBanners();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Post('marketing/banners')
  @ApiOperation({ summary: 'Create a new in-app banner' })
  createBanner(@Body() dto: CreateBannerDto, @CurrentUser() user: any) {
    return this.service.createBanner(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Patch('marketing/banners/:bannerId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a banner' })
  toggleBanner(@Param('bannerId', ParseUUIDPipe) bannerId: string, @CurrentUser() user: any) {
    return this.service.toggleBanner(bannerId, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.SUPPORT_MANAGER)
  @Delete('marketing/banners/:bannerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a banner' })
  deleteBanner(@Param('bannerId', ParseUUIDPipe) bannerId: string, @CurrentUser() user: any) {
    return this.service.deleteBanner(bannerId, user.id, user.email);
  }

  // ─── Plan Management ──────────────────────────────────────────────────────

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Get('plans')
  @ApiOperation({ summary: 'List all subscription plans' })
  listPlans() {
    return this.service.listPlans();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER)
  @Post('plans')
  @ApiOperation({ summary: 'Create a new plan' })
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: any) {
    return this.service.createPlanConfig(dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN)
  @Patch('plans/:tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update plan pricing or features' })
  updatePlanConfig(@Param('tier') tier: string, @Body() dto: UpdatePlanConfigDto, @CurrentUser() user: any) {
    return this.service.updatePlanConfig(tier, dto, user.id, user.email);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER)
  @Delete('plans/:tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a plan (only if no active subscribers)' })
  deletePlan(@Param('tier') tier: string, @CurrentUser() user: any) {
    return this.service.deletePlanConfig(tier, user.id, user.email);
  }
}
