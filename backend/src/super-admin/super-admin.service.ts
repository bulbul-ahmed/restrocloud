import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, PlanTier, UserRole, OrderStatus, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { PlatformRevenueQueryDto, RevenueGroupBy } from './dto/platform-revenue-query.dto';
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
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanConfigDto } from './dto/update-plan-config.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { EmailService } from '../common/email/email.service';
import { BroadcastSegment } from '@prisma/client';

const AUDIT_LOG_KEY = 'audit:global:log';
const AUDIT_MAX_ENTRIES = 500;
const PLATFORM_TENANT_SLUG = 'restrocloud-platform';

export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetName: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  // ─── M10.1 Platform KPIs ─────────────────────────────────────────────────

  async getPlatformKpis() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const activeSessionWindow = new Date(Date.now() - 15 * 60 * 1000); // 15 min

    const [
      totalTenants,
      activeTenants,
      totalRestaurants,
      totalUsers,
      todayOrders,
      allTimeRevenue,
      todayRevenue,
      newTenantsThisMonth,
      churnedThisMonth,
      churnedLastMonth,
      convertedThisMonth,
      activeUsersNow,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { slug: { not: PLATFORM_TENANT_SLUG } } }),
      this.prisma.tenant.count({ where: { slug: { not: PLATFORM_TENANT_SLUG }, isActive: true } }),
      this.prisma.restaurant.count(),
      this.prisma.user.count({ where: { role: { not: UserRole.SUPER_ADMIN } } }),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart }, status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: [OrderStatus.COMPLETED, OrderStatus.REFUNDED] } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: todayStart },
          status: { in: [OrderStatus.COMPLETED, OrderStatus.REFUNDED] },
        },
      }),
      this.prisma.tenant.count({
        where: { createdAt: { gte: monthStart }, slug: { not: PLATFORM_TENANT_SLUG } },
      }),
      // Churn: terminated this month
      this.prisma.tenant.count({
        where: { terminatedAt: { gte: monthStart }, slug: { not: PLATFORM_TENANT_SLUG } },
      }),
      // Churn last month
      this.prisma.tenant.count({
        where: { terminatedAt: { gte: lastMonthStart, lt: monthStart }, slug: { not: PLATFORM_TENANT_SLUG } },
      }),
      // Trial conversions: STARTER→paid this month (plan != STARTER, updated this month)
      this.prisma.tenant.count({
        where: { plan: { not: PlanTier.STARTER }, updatedAt: { gte: monthStart }, slug: { not: PLATFORM_TENANT_SLUG } },
      }),
      // Active users: logged in within last 15 min
      this.prisma.user.count({
        where: { lastLoginAt: { gte: activeSessionWindow }, isActive: true, role: { not: UserRole.SUPER_ADMIN } },
      }),
    ]);

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: totalTenants - activeTenants,
        newThisMonth: newTenantsThisMonth,
      },
      restaurants: { total: totalRestaurants },
      users: { total: totalUsers },
      orders: {
        today: todayOrders,
        allTimeRevenue: Number(allTimeRevenue._sum.totalAmount || 0),
        todayRevenue: Number(todayRevenue._sum.totalAmount || 0),
      },
      growth: {
        churnedThisMonth,
        churnedLastMonth,
        convertedThisMonth,
        activeUsersNow,
      },
    };
  }

  // ─── M10.2 List Tenants ───────────────────────────────────────────────────

  async listTenants(query: ListTenantsQueryDto) {
    const { search, plan, isActive, page = 1, limit = 20 } = query;

    const where: Prisma.TenantWhereInput = {
      slug: { not: PLATFORM_TENANT_SLUG },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (plan) where.plan = plan;
    if (isActive !== undefined) where.isActive = isActive;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { restaurants: true, users: true } },
          restaurants: { select: { id: true, name: true, isActive: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        isActive: t.isActive,
        trialEndsAt: t.trialEndsAt,
        createdAt: t.createdAt,
        restaurantCount: t._count.restaurants,
        userCount: t._count.users,
        restaurants: t.restaurants,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── M10.3 Tenant Detail ──────────────────────────────────────────────────

  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        restaurants: {
          select: {
            id: true, name: true, slug: true, isActive: true,
            currency: true, timezone: true, createdAt: true,
          },
        },
        users: {
          where: { role: { not: UserRole.SUPER_ADMIN } },
          select: {
            id: true, firstName: true, lastName: true, email: true,
            role: true, isActive: true, lastLoginAt: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const revenue = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: { tenantId, status: { in: [OrderStatus.COMPLETED, OrderStatus.REFUNDED] } },
    });

    const lastOrder = await this.prisma.order.findFirst({
      where: { tenantId, status: { not: OrderStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      ...tenant,
      stats: {
        totalRevenue: Number(revenue._sum.totalAmount || 0),
        totalOrders: revenue._count.id,
        lastOrderAt: lastOrder?.createdAt ?? null,
      },
    };
  }

  // ─── Restaurant brand color ───────────────────────────────────────────────

  async updateRestaurantBrand(tenantId: string, restaurantId: string, brandColor: string) {
    const restaurant = await this.prisma.restaurant.findFirst({ where: { id: restaurantId, tenantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const updated = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { brandColor },
      select: { id: true, name: true, brandColor: true },
    });
    return updated;
  }

  // ─── M10.4 Suspend Tenant ─────────────────────────────────────────────────

  async suspendTenant(tenantId: string, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.slug === PLATFORM_TENANT_SLUG) {
      throw new BadRequestException('Cannot suspend the platform tenant');
    }
    if (!tenant.isActive) throw new BadRequestException('Tenant is already suspended');

    const [updatedTenant, { count }] = await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id: tenantId }, data: { isActive: false } }),
      this.prisma.user.updateMany({
        where: { tenantId, role: { not: UserRole.SUPER_ADMIN } },
        data: { isActive: false },
      }),
    ]);

    // Bust Redis caches so blocked users can't use cached sessions
    await this.redis.flushPattern(`user:*`);

    await this.logAudit('TENANT_SUSPENDED', actorId, actorEmail, tenantId, tenant.name, {
      affectedUsers: count,
    });

    this.logger.warn(`Tenant suspended: ${tenant.name} (${tenantId}) by ${actorEmail}`);

    return { tenant: updatedTenant, affectedUsers: count };
  }

  // ─── M10.5 Activate Tenant ───────────────────────────────────────────────

  async activateTenant(tenantId: string, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.isActive) throw new BadRequestException('Tenant is already active');

    const [updatedTenant, { count }] = await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id: tenantId }, data: { isActive: true } }),
      this.prisma.user.updateMany({
        where: { tenantId, role: { not: UserRole.SUPER_ADMIN } },
        data: { isActive: true },
      }),
    ]);

    await this.logAudit('TENANT_ACTIVATED', actorId, actorEmail, tenantId, tenant.name, {
      reactivatedUsers: count,
    });

    this.logger.log(`Tenant activated: ${tenant.name} (${tenantId}) by ${actorEmail}`);

    return { tenant: updatedTenant, reactivatedUsers: count };
  }

  // ─── M10.6 Update Plan ───────────────────────────────────────────────────

  async updatePlan(tenantId: string, dto: UpdatePlanDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.slug === PLATFORM_TENANT_SLUG) {
      throw new BadRequestException('Cannot change plan of the platform tenant');
    }

    const prevPlan = tenant.plan;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: dto.plan },
    });

    await this.logAudit('PLAN_CHANGED', actorId, actorEmail, tenantId, tenant.name, {
      from: prevPlan,
      to: dto.plan,
    });

    return updated;
  }

  // ─── M10.7 Impersonate Restaurant ────────────────────────────────────────

  async impersonate(
    tenantId: string,
    dto: ImpersonateDto,
    actorId: string,
    actorEmail: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.isActive) throw new BadRequestException('Cannot impersonate a suspended tenant');

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: dto.restaurantId, tenantId },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found in this tenant');

    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: UserRole.OWNER, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!owner) throw new NotFoundException('No active owner found for this tenant');

    const payload = {
      sub: owner.id,
      tenantId: owner.tenantId,
      role: owner.role,
      email: owner.email,
      restaurantId: dto.restaurantId,
      impersonatedBy: actorId,
    };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: '1h',
      secret: this.config.get('JWT_SECRET', 'restrocloud-dev-secret-change-in-prod'),
    });

    await this.logAudit('IMPERSONATION', actorId, actorEmail, tenantId, tenant.name, {
      restaurantId: dto.restaurantId,
      restaurantName: restaurant.name,
      impersonatedUserId: owner.id,
      impersonatedUserEmail: owner.email,
    });

    this.logger.warn(
      `Impersonation: ${actorEmail} → ${tenant.name}/${restaurant.name} (as ${owner.email})`,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '1h',
      impersonating: {
        tenantId,
        tenantName: tenant.name,
        restaurantId: dto.restaurantId,
        restaurantName: restaurant.name,
        userId: owner.id,
        userEmail: owner.email,
      },
    };
  }

  // ─── M10.8 Platform Revenue ──────────────────────────────────────────────

  async getPlatformRevenue(query: PlatformRevenueQueryDto) {
    const { groupBy = RevenueGroupBy.DAY } = query;
    const { from, to } = this.parseDateRange(query.dateFrom, query.dateTo);

    // Prisma.raw needed for date trunc unit (string literal in SQL, enum-validated so safe)
    const truncUnit = Prisma.raw(`'${groupBy}'`);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC(${truncUnit}, "createdAt")::date AS date,
          COALESCE(SUM("totalAmount"), 0)::float       AS revenue,
          COUNT(*)::bigint                             AS orders,
          COUNT(DISTINCT "tenantId")::bigint           AS active_tenants
        FROM orders
        WHERE "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND status::text NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY DATE_TRUNC(${truncUnit}, "createdAt")
        ORDER BY date
      `,
    );

    const summary = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: {
        createdAt: { gte: from, lte: to },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      },
    });

    return {
      groupBy,
      dateFrom: from,
      dateTo: to,
      summary: {
        totalRevenue: Number(summary._sum.totalAmount || 0),
        totalOrders: summary._count.id,
      },
      data: rows.map((r) => ({
        date: r.date,
        revenue: r.revenue,
        orders: Number(r.orders),
        activeTenants: Number(r.active_tenants),
      })),
    };
  }

  // ─── M10.9 Audit Log ─────────────────────────────────────────────────────

  async getAuditLog(page = 1, limit = 50) {
    const entries = (await this.redis.getJson<AuditEntry[]>(AUDIT_LOG_KEY)) || [];
    const total = entries.length;
    const start = (page - 1) * limit;
    const slice = entries.slice(start, start + limit);

    return {
      data: slice,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── M10.10 List Super Admins ─────────────────────────────────────────────

  async listSuperAdmins() {
    const SA_ROLES = [
      UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT, UserRole.ENGINEERING_ADMIN,
    ];
    return this.prisma.user.findMany({
      where: { role: { in: SA_ROLES } },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        role: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── M10.11 Create Super Admin ────────────────────────────────────────────

  async createSuperAdmin(dto: CreateSuperAdminDto, actorId: string, actorEmail: string) {
    const platformTenant = await this.prisma.tenant.upsert({
      where: { slug: PLATFORM_TENANT_SLUG },
      update: {},
      create: {
        name: 'RestroCloud Platform',
        slug: PLATFORM_TENANT_SLUG,
        plan: PlanTier.ENTERPRISE,
      },
    });

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: platformTenant.id, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const admin = await this.prisma.user.create({
      data: {
        tenantId: platformTenant.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        role: dto.role ?? UserRole.SUPER_ADMIN,
        isVerified: true,
        isActive: true,
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, isActive: true, createdAt: true,
      },
    });

    await this.logAudit(
      'SUPER_ADMIN_CREATED',
      actorId,
      actorEmail,
      admin.id,
      `${dto.firstName} ${dto.lastName}`,
      { email: dto.email },
    );

    return admin;
  }

  // ─── M10.12 Deactivate Super Admin ───────────────────────────────────────

  async deactivateSuperAdmin(userId: string, actorId: string, actorEmail: string) {
    if (userId === actorId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, role: true, firstName: true, lastName: true,
        email: true, isActive: true,
      },
    });

    const SA_ROLES = [
      UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT, UserRole.ENGINEERING_ADMIN,
    ];
    if (!admin) throw new NotFoundException('User not found');
    if (!(SA_ROLES as UserRole[]).includes(admin.role)) {
      throw new BadRequestException('User is not a super admin');
    }
    if (!admin.isActive) throw new BadRequestException('User is already deactivated');

    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.redis.del(`user:${userId}`);

    await this.logAudit(
      'SUPER_ADMIN_DEACTIVATED',
      actorId,
      actorEmail,
      userId,
      `${admin.firstName} ${admin.lastName}`,
      { email: admin.email },
    );

    return { message: `Super admin ${admin.email} deactivated` };
  }

  // ─── M10.13 System Health ─────────────────────────────────────────────────

  async getSystemHealth() {
    const checks: Record<string, any> = {};

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (e) {
      checks.database = { status: 'unhealthy', error: (e as Error).message };
    }

    try {
      const start = Date.now();
      await this.redis.set('health:ping', 'pong', 10);
      checks.redis = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (e) {
      checks.redis = { status: 'unhealthy', error: (e as Error).message };
    }

    const [tenantCount, restaurantCount, userCount] = await Promise.all([
      this.prisma.tenant.count({ where: { slug: { not: PLATFORM_TENANT_SLUG } } }),
      this.prisma.restaurant.count(),
      this.prisma.user.count({ where: { role: { not: UserRole.SUPER_ADMIN } } }),
    ]);

    const overall = Object.values(checks).every((c) => c.status === 'healthy')
      ? 'healthy'
      : 'degraded';

    return {
      status: overall,
      checks,
      counts: { tenants: tenantCount, restaurants: restaurantCount, users: userCount },
      timestamp: new Date().toISOString(),
    };
  }

  // ─── SA-A.1 Apply Credit ──────────────────────────────────────────────────

  async applyCredit(tenantId: string, dto: ApplyCreditDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.slug === PLATFORM_TENANT_SLUG) throw new BadRequestException('Cannot credit platform tenant');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { creditBalance: { increment: dto.amount } },
      select: { id: true, name: true, creditBalance: true },
    });

    await this.logAudit('CREDIT_APPLIED', actorId, actorEmail, tenantId, tenant.name, {
      amount: dto.amount,
      reason: dto.reason,
      newBalance: updated.creditBalance,
    });

    return updated;
  }

  // ─── SA-A.2 Extend Trial ──────────────────────────────────────────────────

  async extendTrial(tenantId: string, dto: ExtendTrialDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.slug === PLATFORM_TENANT_SLUG) throw new BadRequestException('Cannot extend trial for platform tenant');

    const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
    const newTrialEndsAt = new Date(base.getTime() + dto.days * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { trialEndsAt: newTrialEndsAt },
      select: { id: true, name: true, trialEndsAt: true },
    });

    await this.logAudit('TRIAL_EXTENDED', actorId, actorEmail, tenantId, tenant.name, {
      days: dto.days,
      newTrialEndsAt,
    });

    return updated;
  }

  // ─── SA-A.3 Terminate Tenant ──────────────────────────────────────────────

  async terminateTenant(tenantId: string, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.slug === PLATFORM_TENANT_SLUG) throw new BadRequestException('Cannot terminate the platform tenant');
    if (tenant.terminatedAt) throw new BadRequestException('Tenant is already terminated');

    const now = new Date();
    const [updatedTenant, { count }] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false, terminatedAt: now },
      }),
      this.prisma.user.updateMany({
        where: { tenantId, role: { not: UserRole.SUPER_ADMIN } },
        data: { isActive: false },
      }),
    ]);

    await this.redis.flushPattern('user:*');

    await this.logAudit('TENANT_TERMINATED', actorId, actorEmail, tenantId, tenant.name, {
      terminatedAt: now,
      affectedUsers: count,
    });

    this.logger.warn(`Tenant TERMINATED: ${tenant.name} (${tenantId}) by ${actorEmail}`);

    return { tenant: updatedTenant, affectedUsers: count };
  }

  // ─── SA Password Reset for Tenant User ───────────────────────────────────

  async sendPasswordResetForUser(
    tenantId: string,
    userId: string,
    actorId: string,
    actorEmail: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, firstName: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');
    if (!user.email) throw new BadRequestException('User has no email address');

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
    });

    await this.email.sendPasswordResetEmail(user.email, user.firstName, resetToken);

    await this.logAudit('PASSWORD_RESET_SENT', actorId, actorEmail, tenantId, tenant.name, {
      targetUserId: userId,
      targetEmail: user.email,
    });

    return { message: `Password reset email sent to ${user.email}` };
  }

  // ─── SA-A.4 Flag / Unflag for Review ─────────────────────────────────────

  async flagTenant(tenantId: string, dto: FlagTenantDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { flaggedForReview: true, flagReason: dto.reason ?? null },
      select: { id: true, name: true, flaggedForReview: true, flagReason: true },
    });

    await this.logAudit('TENANT_FLAGGED', actorId, actorEmail, tenantId, tenant.name, {
      reason: dto.reason,
    });

    return updated;
  }

  async unflagTenant(tenantId: string, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { flaggedForReview: false, flagReason: null },
      select: { id: true, name: true, flaggedForReview: true },
    });

    await this.logAudit('TENANT_UNFLAGGED', actorId, actorEmail, tenantId, tenant.name, {});

    return updated;
  }

  // ─── SA-A.5 Tenant Notes ──────────────────────────────────────────────────

  async createNote(tenantId: string, dto: CreateTenantNoteDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const note = await this.prisma.tenantNote.create({
      data: { tenantId, content: dto.content, authorId: actorId, authorEmail: actorEmail },
    });

    await this.logAudit('NOTE_ADDED', actorId, actorEmail, tenantId, tenant.name, {
      noteId: note.id,
    });

    return note;
  }

  async listNotes(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenantNote.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteNote(tenantId: string, noteId: string, actorId: string, actorEmail: string) {
    const note = await this.prisma.tenantNote.findFirst({ where: { id: noteId, tenantId } });
    if (!note) throw new NotFoundException('Note not found');

    await this.prisma.tenantNote.delete({ where: { id: noteId } });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    await this.logAudit('NOTE_DELETED', actorId, actorEmail, tenantId, tenant?.name ?? tenantId, {
      noteId,
    });

    return { message: 'Note deleted' };
  }

  // ─── SA-A.6 Assign Account Manager ───────────────────────────────────────

  async assignManager(tenantId: string, dto: AssignManagerDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
        select: { role: true, isActive: true, firstName: true, lastName: true, email: true },
      });
      const SA_ROLES_ARR = [
        UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER, UserRole.FINANCE_ADMIN,
        UserRole.SUPPORT_MANAGER, UserRole.SUPPORT_AGENT, UserRole.ENGINEERING_ADMIN,
      ];
      if (!manager || !(SA_ROLES_ARR as UserRole[]).includes(manager.role)) {
        throw new BadRequestException('Manager must be an active super admin user');
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { accountManagerId: dto.managerId ?? null },
      select: { id: true, name: true, accountManagerId: true },
    });

    await this.logAudit('MANAGER_ASSIGNED', actorId, actorEmail, tenantId, tenant.name, {
      managerId: dto.managerId ?? null,
    });

    return updated;
  }

  // ─── SA-B.1 Finance Overview (MRR / ARR / plan distribution) ────────────

  async getFinanceOverview() {
    // Plan monthly prices (BDT)
    const PLAN_PRICE: Record<string, number> = {
      STARTER: 0,
      GROWTH: 4999,
      PRO: 9999,
      ENTERPRISE: 24999,
    };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [activeTenants, newThisMonth, churnedThisMonth, gmvThisMonth, gmvLastMonth, gmvYtd] =
      await Promise.all([
        // active, non-platform tenants grouped by plan
        this.prisma.tenant.groupBy({
          by: ['plan'],
          where: { slug: { not: PLATFORM_TENANT_SLUG }, isActive: true, terminatedAt: null },
          _count: { id: true },
        }),
        // new sign-ups this month
        this.prisma.tenant.count({
          where: { slug: { not: PLATFORM_TENANT_SLUG }, createdAt: { gte: monthStart } },
        }),
        // suspended or terminated this month
        this.prisma.tenant.count({
          where: {
            slug: { not: PLATFORM_TENANT_SLUG },
            OR: [
              { isActive: false, updatedAt: { gte: monthStart } },
              { terminatedAt: { gte: monthStart } },
            ],
          },
        }),
        // GMV this month (all completed orders)
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: monthStart }, status: OrderStatus.COMPLETED },
        }),
        // GMV last month
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
            status: OrderStatus.COMPLETED,
          },
        }),
        // GMV YTD
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: yearStart }, status: OrderStatus.COMPLETED },
        }),
      ]);

    // Compute MRR from active tenant plan counts
    const planBreakdown = activeTenants.map((g) => ({
      plan: g.plan as string,
      count: g._count.id,
      monthlyPrice: PLAN_PRICE[g.plan] ?? 0,
      mrr: (PLAN_PRICE[g.plan] ?? 0) * g._count.id,
    }));

    const mrr = planBreakdown.reduce((sum, p) => sum + p.mrr, 0);
    const arr = mrr * 12;
    const totalActiveSubscribers = planBreakdown
      .filter((p) => p.plan !== 'STARTER')
      .reduce((s, p) => s + p.count, 0);

    const gmvMonth = Number(gmvThisMonth._sum.totalAmount || 0);
    const gmvPrevMonth = Number(gmvLastMonth._sum.totalAmount || 0);
    const gmvMoMChange = gmvPrevMonth > 0
      ? ((gmvMonth - gmvPrevMonth) / gmvPrevMonth) * 100
      : null;

    return {
      mrr,
      arr,
      totalActiveSubscribers,
      planBreakdown,
      gmv: {
        thisMonth: gmvMonth,
        lastMonth: gmvPrevMonth,
        ytd: Number(gmvYtd._sum.totalAmount || 0),
        momChangePercent: gmvMoMChange !== null ? Math.round(gmvMoMChange * 10) / 10 : null,
      },
      signups: { thisMonth: newThisMonth },
      churn: { thisMonth: churnedThisMonth },
    };
  }

  // ─── SA-B.2 Revenue by plan tier (with per-tenant GMV) ───────────────────

  async getFinancePlanBreakdown(query: FinanceQueryDto) {
    const { from, to } = this.parseDateRange(query.dateFrom, query.dateTo);

    // Tenants grouped by plan (non-platform, non-terminated)
    const tenantsByPlan = await this.prisma.tenant.groupBy({
      by: ['plan'],
      where: { slug: { not: PLATFORM_TENANT_SLUG }, terminatedAt: null },
      _count: { id: true },
    });

    // Per-plan GMV from orders in date range
    const gmvRows = await this.prisma.$queryRaw<{ plan: string; gmv: number; order_count: bigint }[]>(
      Prisma.sql`
        SELECT t.plan, COALESCE(SUM(o."totalAmount"), 0)::float AS gmv, COUNT(o.id)::bigint AS order_count
        FROM tenants t
        LEFT JOIN orders o
          ON o."tenantId" = t.id
          AND o."createdAt" >= ${from}
          AND o."createdAt" <= ${to}
          AND o.status::text NOT IN ('CANCELLED')
        WHERE t.slug != ${PLATFORM_TENANT_SLUG}
          AND t."terminatedAt" IS NULL
        GROUP BY t.plan
        ORDER BY t.plan
      `,
    );

    const gmvByPlan = Object.fromEntries(
      gmvRows.map((r) => [r.plan, { gmv: r.gmv, orderCount: Number(r.order_count) }]),
    );

    return tenantsByPlan.map((g) => ({
      plan: g.plan,
      tenantCount: g._count.id,
      gmv: gmvByPlan[g.plan]?.gmv ?? 0,
      orderCount: gmvByPlan[g.plan]?.orderCount ?? 0,
    }));
  }

  // ─── SA-B.3 Outstanding accounts ─────────────────────────────────────────

  async getOutstandingAccounts() {
    const now = new Date();

    // Trial expired (trialEndsAt < now) and still on STARTER
    const trialExpired = await this.prisma.tenant.findMany({
      where: {
        slug: { not: PLATFORM_TENANT_SLUG },
        isActive: true,
        terminatedAt: null,
        plan: PlanTier.STARTER,
        trialEndsAt: { lt: now },
      },
      select: {
        id: true, name: true, slug: true, plan: true,
        trialEndsAt: true, createdAt: true,
        _count: { select: { restaurants: true } },
      },
      orderBy: { trialEndsAt: 'asc' },
    });

    // Suspended tenants (potential non-payment)
    const suspended = await this.prisma.tenant.findMany({
      where: {
        slug: { not: PLATFORM_TENANT_SLUG },
        isActive: false,
        terminatedAt: null,
      },
      select: {
        id: true, name: true, slug: true, plan: true,
        trialEndsAt: true, createdAt: true, updatedAt: true,
        _count: { select: { restaurants: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Flagged for review
    const flagged = await this.prisma.tenant.findMany({
      where: {
        slug: { not: PLATFORM_TENANT_SLUG },
        flaggedForReview: true,
        terminatedAt: null,
      },
      select: {
        id: true, name: true, slug: true, plan: true,
        flagReason: true, createdAt: true,
        _count: { select: { restaurants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      trialExpired: trialExpired.map((t) => ({
        ...t,
        restaurantCount: t._count.restaurants,
        daysSinceExpiry: Math.floor((now.getTime() - new Date(t.trialEndsAt!).getTime()) / 86400000),
      })),
      suspended: suspended.map((t) => ({ ...t, restaurantCount: t._count.restaurants })),
      flagged: flagged.map((t) => ({ ...t, restaurantCount: t._count.restaurants })),
      summary: {
        trialExpiredCount: trialExpired.length,
        suspendedCount: suspended.length,
        flaggedCount: flagged.length,
      },
    };
  }

  // ─── SA-B.4 GMV trend (monthly for last 12 months) ───────────────────────

  async getGmvTrend() {
    const truncUnit = Prisma.raw(`'month'`);
    const from = new Date();
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC(${truncUnit}, "createdAt")::date AS month,
          COALESCE(SUM("totalAmount"), 0)::float       AS gmv,
          COUNT(*)::bigint                             AS orders,
          COUNT(DISTINCT "tenantId")::bigint           AS tenants
        FROM orders
        WHERE "createdAt" >= ${from}
          AND status::text NOT IN ('CANCELLED')
        GROUP BY DATE_TRUNC(${truncUnit}, "createdAt")
        ORDER BY month
      `,
    );

    return rows.map((r) => ({
      month: r.month,
      gmv: r.gmv,
      orders: Number(r.orders),
      tenants: Number(r.tenants),
    }));
  }

  // ─── C.5 SA-wide Refund List ─────────────────────────────────────────────

  async listSaRefunds(query: {
    status?: string;
    tenantId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo + 'T23:59:59.999Z');
    }

    const [refunds, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              method: true,
              orderId: true,
              restaurantId: true,
              restaurant: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.refund.count({ where }),
    ]);

    // Enrich with tenant name
    const tenantIds = [...new Set(refunds.map((r) => r.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true },
    });
    const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

    return {
      data: refunds.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        tenant: tenantMap[r.tenantId] ?? null,
        paymentId: r.paymentId,
        orderId: r.payment.orderId,
        restaurantId: r.payment.restaurantId,
        restaurant: r.payment.restaurant,
        amount: Number(r.amount),
        currency: r.payment.currency,
        reason: r.reason,
        status: r.status,
        gatewayRefId: r.gatewayRefId,
        processedAt: r.processedAt,
        createdAt: r.createdAt,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── C.6 Tax Report by Country ───────────────────────────────────────────

  async getTaxReport(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const from = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const to = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          r.country,
          COUNT(DISTINCT o."tenantId")::int          AS tenant_count,
          COUNT(o.id)::int                           AS order_count,
          COALESCE(SUM(o."taxAmount"), 0)::float     AS total_tax,
          COALESCE(SUM(o."totalAmount"), 0)::float   AS total_gmv
        FROM orders o
        JOIN restaurants r ON r.id = o."restaurantId"
        WHERE o."createdAt" >= ${from}
          AND o."createdAt" <= ${to}
          AND o.status::text NOT IN ('CANCELLED')
        GROUP BY r.country
        ORDER BY total_tax DESC
      `,
    );

    const grandTotalTax = rows.reduce((s, r) => s + r.total_tax, 0);
    const grandTotalGmv = rows.reduce((s, r) => s + r.total_gmv, 0);

    return {
      year: targetYear,
      grandTotalTax,
      grandTotalGmv,
      rows: rows.map((r) => ({
        country: r.country,
        tenantCount: r.tenant_count,
        orderCount: r.order_count,
        totalTax: r.total_tax,
        totalGmv: r.total_gmv,
        effectiveTaxRate: r.total_gmv > 0 ? (r.total_tax / r.total_gmv) * 100 : 0,
      })),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async logAudit(
    action: string,
    actorId: string,
    actorEmail: string,
    targetId: string,
    targetName: string,
    metadata?: Record<string, any>,
  ) {
    const entry: AuditEntry = {
      id: uuidv4(),
      action,
      actorId,
      actorEmail,
      targetId,
      targetName,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const existing = (await this.redis.getJson<AuditEntry[]>(AUDIT_LOG_KEY)) || [];
    existing.unshift(entry);
    if (existing.length > AUDIT_MAX_ENTRIES) existing.length = AUDIT_MAX_ENTRIES;
    await this.redis.setJson(AUDIT_LOG_KEY, existing);
  }

  private parseDateRange(dateFrom?: string, dateTo?: string) {
    const to = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : new Date();
    const from = dateFrom
      ? new Date(dateFrom + 'T00:00:00.000Z')
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  // ─── SA-C Feature Flags ──────────────────────────────────────────────────────

  private flagKey(key: string) { return `feature:flag:${key}`; }
  private flagKeysSet() { return 'feature:flag:keys'; }
  private tenantFlagKey(tenantId: string, key: string) { return `feature:tenant:${tenantId}:${key}`; }
  private tenantFlagKeysSet(tenantId: string) { return `feature:tenant:${tenantId}:keys`; }

  async listFeatureFlags(): Promise<any[]> {
    const keys = await this.redis.smembers(this.flagKeysSet());
    if (keys.length === 0) return [];
    const flags = await Promise.all(keys.map((k) => this.redis.getJson<any>(this.flagKey(k))));
    return flags.filter(Boolean).sort((a, b) => a.key.localeCompare(b.key));
  }

  async setFeatureFlag(dto: SetFeatureFlagDto, actorId: string, actorEmail: string): Promise<any> {
    const flag = {
      key: dto.key,
      enabled: dto.enabled,
      description: dto.description ?? '',
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.flagKey(dto.key), JSON.stringify(flag));
    await this.redis.sadd(this.flagKeysSet(), dto.key);
    await this.logAudit('FEATURE_FLAG_SET', actorId, actorEmail, dto.key, dto.key, { enabled: dto.enabled });
    return flag;
  }

  async deleteFeatureFlag(key: string, actorId: string, actorEmail: string): Promise<void> {
    await this.redis.del(this.flagKey(key));
    await this.redis.srem(this.flagKeysSet(), key);
    await this.logAudit('FEATURE_FLAG_DELETED', actorId, actorEmail, key, key);
  }

  async getTenantFeatureOverrides(tenantId: string): Promise<any[]> {
    const keys = await this.redis.smembers(this.tenantFlagKeysSet(tenantId));
    if (keys.length === 0) return [];
    const flags = await Promise.all(
      keys.map((k) => this.redis.getJson<any>(this.tenantFlagKey(tenantId, k))),
    );
    return flags.filter(Boolean).sort((a, b) => a.key.localeCompare(b.key));
  }

  async setTenantFeatureOverride(
    tenantId: string,
    dto: SetTenantFeatureFlagDto,
    actorId: string,
    actorEmail: string,
  ): Promise<any> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const flag = {
      key: dto.key,
      enabled: dto.enabled,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.tenantFlagKey(tenantId, dto.key), JSON.stringify(flag));
    await this.redis.sadd(this.tenantFlagKeysSet(tenantId), dto.key);
    await this.logAudit('TENANT_FEATURE_OVERRIDE_SET', actorId, actorEmail, tenantId, tenant.name, { key: dto.key, enabled: dto.enabled });
    return flag;
  }

  async deleteTenantFeatureOverride(
    tenantId: string,
    key: string,
    actorId: string,
    actorEmail: string,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.redis.del(this.tenantFlagKey(tenantId, key));
    await this.redis.srem(this.tenantFlagKeysSet(tenantId), key);
    await this.logAudit('TENANT_FEATURE_OVERRIDE_DELETED', actorId, actorEmail, tenantId, tenant.name, { key });
  }

  // ─── SA-D Support Tickets ────────────────────────────────────────────────────

  async createTicket(dto: CreateTicketDto, actorId: string, actorEmail: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: dto.subject,
        description: dto.description,
        tenantId: dto.tenantId ?? null,
        priority: dto.priority ?? 'MEDIUM',
        submittedBy: actorEmail,
      },
      include: { messages: true, tenant: { select: { name: true } } },
    });
    await this.logAudit('TICKET_CREATED', actorId, actorEmail, ticket.id, ticket.subject);
    return ticket;
  }

  async listTickets(query: ListTicketsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.tenantId) where.tenantId = query.tenantId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true, slug: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        tenant: { select: { name: true, slug: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateTicket(ticketId: string, dto: UpdateTicketDto, actorId: string, actorEmail: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const now = new Date();
    const data: Prisma.SupportTicketUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === TicketStatus.RESOLVED) data.resolvedAt = now;
      if (dto.status === TicketStatus.CLOSED) data.closedAt = now;
    }
    if (dto.priority !== undefined) data.priority = dto.priority;
    if ('assignedTo' in dto) data.assignedTo = dto.assignedTo ?? null;

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
      include: { messages: true, tenant: { select: { name: true } } },
    });
    await this.logAudit('TICKET_UPDATED', actorId, actorEmail, ticketId, ticket.subject, { changes: dto });
    return updated;
  }

  async addTicketMessage(ticketId: string, dto: AddTicketMessageDto, actorId: string, actorEmail: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException('Cannot reply to a closed ticket');

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        authorId: actorId,
        authorEmail: actorEmail,
        isStaff: true,
        content: dto.content,
      },
    });
    // Auto-move to IN_PROGRESS on first staff reply
    if (ticket.status === TicketStatus.OPEN) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      });
    }
    return message;
  }

  async getTicketStats() {
    const [byStatus, byPriority, total] = await Promise.all([
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: true }),
      this.prisma.supportTicket.groupBy({ by: ['priority'], _count: true }),
      this.prisma.supportTicket.count(),
    ]);
    return { total, byStatus, byPriority };
  }

  // ─── SA-D Announcements ──────────────────────────────────────────────────────

  async createAnnouncement(dto: CreateAnnouncementDto, actorId: string, actorEmail: string) {
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        authorId: actorId,
        authorEmail: actorEmail,
        ...(scheduledFor ? { scheduledFor } : {}),
      },
    });
    await this.logAudit('ANNOUNCEMENT_CREATED', actorId, actorEmail, announcement.id, dto.title);
    return announcement;
  }

  // SA view: all announcements including scheduled-future ones
  async listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  // Public view: only live announcements (scheduledFor IS NULL OR scheduledFor <= now)
  async listLiveAnnouncements() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async deleteAnnouncement(announcementId: string, actorId: string, actorEmail: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!ann) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id: announcementId } });
    await this.logAudit('ANNOUNCEMENT_DELETED', actorId, actorEmail, announcementId, ann.title);
  }

  // ─── G.5 Knowledge Base ────────────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async listKbArticles(options?: { category?: string; published?: boolean }) {
    const where: any = {};
    if (options?.category) where.category = options.category;
    if (options?.published !== undefined) where.isPublished = options.published;
    return this.prisma.kbArticle.findMany({ where, orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] });
  }

  async getKbArticle(slug: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async createKbArticle(dto: CreateKbArticleDto, actorId: string, actorEmail: string) {
    const slug = dto.slug ? dto.slug : this.slugify(dto.title);
    const existing = await this.prisma.kbArticle.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already taken — provide a unique slug`);
    const article = await this.prisma.kbArticle.create({
      data: {
        title: dto.title,
        slug,
        body: dto.body,
        category: dto.category ?? 'general',
        isPublished: dto.isPublished ?? false,
        authorId: actorId,
        authorEmail: actorEmail,
      },
    });
    await this.logAudit('KB_ARTICLE_CREATED', actorId, actorEmail, article.id, article.title);
    return article;
  }

  async updateKbArticle(slug: string, dto: UpdateKbArticleDto, actorId: string, actorEmail: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');
    const updated = await this.prisma.kbArticle.update({ where: { slug }, data: dto as any });
    await this.logAudit('KB_ARTICLE_UPDATED', actorId, actorEmail, article.id, article.title);
    return updated;
  }

  async deleteKbArticle(slug: string, actorId: string, actorEmail: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.kbArticle.delete({ where: { slug } });
    await this.logAudit('KB_ARTICLE_DELETED', actorId, actorEmail, article.id, article.title);
  }

  // ─── SA-F Cross-tenant User Management ──────────────────────────────────────

  private readonly USER_SELECT = {
    id: true, firstName: true, lastName: true, email: true, phone: true,
    role: true, isActive: true, isVerified: true, lastLoginAt: true, createdAt: true,
    tenantId: true, restaurantId: true,
    tenant: { select: { name: true, slug: true, plan: true } },
    restaurant: { select: { name: true, slug: true } },
  } as const;

  async listPlatformUsers(query: ListPlatformUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.phone) where.phone = { contains: query.phone, mode: 'insensitive' };
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.tenantId) where.tenantId = query.tenantId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: this.USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getPlatformUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async resetUserPassword(userId: string, actorId: string, actorEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Generate a random temporary password
    const tempPassword = `Tmp${uuidv4().replace(/-/g, '').slice(0, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });
    await this.redis.del(`user:${userId}`);

    await this.logAudit('USER_PASSWORD_RESET', actorId, actorEmail, userId,
      `${user.firstName} ${user.lastName}`, { email: user.email });

    // Return temp password so super admin can share with user securely
    return { tempPassword, message: 'Password reset. Share this with the user via a secure channel.' };
  }

  async unlockUser(userId: string, actorId: string, actorEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.isActive) throw new BadRequestException('User is already active');

    await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    await this.redis.del(`user:${userId}`);

    await this.logAudit('USER_UNLOCKED', actorId, actorEmail, userId,
      `${user.firstName} ${user.lastName}`);

    return { message: 'User reactivated successfully' };
  }

  // ─── B.7 Login History ───────────────────────────────────────────────────────

  async getUserLoginHistory(userId: string, page = 1, limit = 50) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.userLoginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userLoginHistory.count({ where: { userId } }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ─── A.12 Manual Restaurant Creation ─────────────────────────────────────────

  async createRestaurant(dto: CreateRestaurantDto, actorId: string, actorEmail: string) {
    // 1. Guard: email must be unique across the platform
    const existing = await this.prisma.user.findFirst({ where: { email: dto.ownerEmail } });
    if (existing) throw new ConflictException('Email already registered');

    // 2. Generate a cryptographically secure temp password
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 3. Derive locale settings from country
    const currency = this.getCurrencyForCountry(dto.country);
    const timezone = this.getTimezoneForCountry(dto.country);

    // 4. Build slug
    const baseSlug = dto.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${baseSlug}-${uuidv4().slice(0, 6)}`;

    // 5. Trial period
    const trialEndsAt = dto.trialDays > 0
      ? new Date(Date.now() + dto.trialDays * 24 * 60 * 60 * 1000)
      : null;

    // 6. Create tenant → user → restaurant in a transaction
    const { tenant, user, restaurant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.restaurantName,
          slug,
          plan: dto.plan,
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.ownerEmail,
          phone: dto.ownerPhone,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName,
          passwordHash,
          role: 'OWNER',
          isVerified: true,   // SA-created accounts skip email verification
          isActive: true,
        },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          tenantId: tenant.id,
          name: dto.restaurantName,
          slug: baseSlug,
          country: dto.country,
          city: dto.city,
          address: dto.address,
          phone: dto.restaurantPhone,
          email: dto.restaurantEmail,
          currency,
          timezone,
        },
      });

      // Link the owner user to the restaurant
      await tx.user.update({
        where: { id: user.id },
        data: { restaurantId: restaurant.id },
      });

      // Optional internal note
      if (dto.internalNotes?.trim()) {
        await tx.tenantNote.create({
          data: {
            tenantId: tenant.id,
            content: dto.internalNotes.trim(),
            authorId: actorId,
            authorEmail: actorEmail,
          },
        });
      }

      return { tenant, user, restaurant };
    });

    // 7. Send welcome email (non-blocking)
    if (dto.sendWelcomeEmail) {
      this.email.sendOwnerWelcomeEmail(
        dto.ownerEmail,
        dto.ownerFirstName,
        dto.restaurantName,
        tempPassword,
      ).catch(() => {});
    }

    // 8. Audit log
    await this.logAudit(
      'RESTAURANT_CREATED',
      actorId,
      actorEmail,
      tenant.id,
      dto.restaurantName,
      { plan: dto.plan, trialDays: dto.trialDays, ownerEmail: dto.ownerEmail, country: dto.country },
    );

    return {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      userId: user.id,
      tempPassword,              // shown once — SA must hand-off or email has it
      plan: dto.plan,
      trialEndsAt,
      welcomeEmailSent: dto.sendWelcomeEmail,
    };
  }

  private generateTempPassword(): string {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower  = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%';
    const all = upper + lower + digits + special;
    // Guarantee at least one of each category
    const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
    const base = [rand(upper), rand(lower), rand(digits), rand(special)];
    for (let i = 0; i < 8; i++) base.push(rand(all));
    // Shuffle
    return base.sort(() => Math.random() - 0.5).join('');
  }

  private getCurrencyForCountry(country: string): string {
    const map: Record<string, string> = {
      BD: 'BDT', IN: 'INR', US: 'USD', GB: 'GBP',
      AE: 'AED', SA: 'SAR', MY: 'MYR', SG: 'SGD',
    };
    return map[country] ?? 'USD';
  }

  private getTimezoneForCountry(country: string): string {
    const map: Record<string, string> = {
      BD: 'Asia/Dhaka', IN: 'Asia/Kolkata', US: 'America/New_York',
      GB: 'Europe/London', AE: 'Asia/Dubai', MY: 'Asia/Kuala_Lumpur',
      SG: 'Asia/Singapore', SA: 'Asia/Riyadh',
    };
    return map[country] ?? 'UTC';
  }

  // ─── SA-G Subscription & Billing ─────────────────────────────────────────────

  async getSubscriptions(params?: { plan?: PlanTier; isActive?: boolean; page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;
    const where: Prisma.TenantWhereInput = { terminatedAt: null };
    if (params?.plan) where.plan = params.plan;
    if (params?.isActive !== undefined) where.isActive = params.isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true,
          trialEndsAt: true, creditBalance: true, createdAt: true,
          _count: { select: { restaurants: true, users: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getTrialConversions() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalTrials, convertedThisMonth, convertedLastMonth, activeTrials, expiredTrials] =
      await Promise.all([
        this.prisma.tenant.count({ where: { trialEndsAt: { not: null } } }),
        this.prisma.tenant.count({
          where: { plan: { not: PlanTier.STARTER }, updatedAt: { gte: monthStart } },
        }),
        this.prisma.tenant.count({
          where: { plan: { not: PlanTier.STARTER }, updatedAt: { gte: lastMonthStart, lt: monthStart } },
        }),
        this.prisma.tenant.count({ where: { trialEndsAt: { gte: now } } }),
        this.prisma.tenant.count({ where: { trialEndsAt: { lt: now }, plan: PlanTier.STARTER } }),
      ]);

    const conversionRateThisMonth = totalTrials > 0
      ? Math.round((convertedThisMonth / totalTrials) * 100) : 0;

    return { totalTrials, activeTrials, expiredTrials, convertedThisMonth, convertedLastMonth, conversionRateThisMonth };
  }

  async listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });
  }

  async createCoupon(dto: CreateCouponDto, actorId: string, actorEmail: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException('Coupon code already exists');

    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        discountPct: dto.discountPct,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: actorEmail,
      },
    });
    await this.logAudit('COUPON_CREATED', actorId, actorEmail, coupon.id, coupon.code, { discountPct: dto.discountPct });
    return coupon;
  }

  async toggleCoupon(couponId: string, actorId: string, actorEmail: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: !coupon.isActive },
    });
    await this.logAudit('COUPON_TOGGLED', actorId, actorEmail, couponId, coupon.code, { isActive: updated.isActive });
    return updated;
  }

  async applyCouponToTenant(couponId: string, tenantId: string, actorId: string, actorEmail: string) {
    const [coupon, tenant] = await Promise.all([
      this.prisma.coupon.findUnique({ where: { id: couponId }, include: { _count: { select: { usages: true } } } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    ]);
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!coupon.isActive) throw new BadRequestException('Coupon is inactive');
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException('Coupon has expired');
    if (coupon.maxUses !== null && coupon._count.usages >= coupon.maxUses) throw new BadRequestException('Coupon usage limit reached');

    const usage = await this.prisma.couponUsage.upsert({
      where: { couponId_tenantId: { couponId, tenantId } },
      update: {},
      create: { couponId, tenantId, appliedBy: actorEmail },
    });
    await this.prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
    await this.logAudit('COUPON_APPLIED', actorId, actorEmail, tenantId, tenant.name, { code: coupon.code, discountPct: coupon.discountPct });
    return usage;
  }

  // ─── SA-D Invoices ───────────────────────────────────────────────────────────

  async listSaInvoices(params: {
    tenantId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { tenantId, status, dateFrom, dateTo, page = 1, limit = 25 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status as any;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { tenant: { select: { name: true, slug: true, plan: true } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async createSaInvoice(dto: CreateInvoiceDto, actorId: string, actorEmail: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId }, select: { name: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const total = dto.lineItems.reduce((sum, item) => sum + item.amount, 0);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: dto.tenantId,
        amount: total,
        currency: dto.currency ?? 'USD',
        status: 'UNPAID',
        dueAt: new Date(dto.dueAt),
        lineItems: dto.lineItems as any,
      },
      include: { tenant: { select: { name: true, slug: true, plan: true } } },
    });

    await this.logAudit('INVOICE_CREATED', actorId, actorEmail, invoice.id, tenant.name, {
      amount: total,
      currency: invoice.currency,
      lineItems: dto.lineItems.length,
    });

    return invoice;
  }

  async markInvoicePaid(invoiceId: string, actorId: string, actorEmail: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice is already paid');

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
      include: { tenant: { select: { name: true, slug: true, plan: true } } },
    });

    await this.logAudit('INVOICE_MARKED_PAID', actorId, actorEmail, invoiceId, invoice.tenant.name, { amount: invoice.amount });
    return updated;
  }

  async voidInvoice(invoiceId: string, actorId: string, actorEmail: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') throw new BadRequestException('Cannot void a paid invoice');

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'VOID' },
      include: { tenant: { select: { name: true, slug: true, plan: true } } },
    });

    await this.logAudit('INVOICE_VOIDED', actorId, actorEmail, invoiceId, invoice.tenant.name, { amount: invoice.amount });
    return updated;
  }

  // ─── SA-I Email Broadcasts ───────────────────────────────────────────────────

  async listBroadcasts() {
    return this.prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async sendBroadcast(dto: SendBroadcastDto, actorId: string, actorEmail: string) {
    const segment = dto.segment ?? BroadcastSegment.ALL;

    // Build recipient query based on segment
    const tenantWhere: Prisma.TenantWhereInput = { slug: { not: PLATFORM_TENANT_SLUG }, isActive: true };
    if (segment === BroadcastSegment.TRIAL) tenantWhere.trialEndsAt = { gte: new Date() };
    if (segment === BroadcastSegment.PAID) {
      tenantWhere.plan = { not: PlanTier.STARTER };
      tenantWhere.trialEndsAt = null;
    }
    if (segment === BroadcastSegment.SUSPENDED) {
      delete tenantWhere.isActive;
      tenantWhere.isActive = false;
    }

    const tenants = await this.prisma.tenant.findMany({
      where: tenantWhere,
      select: { id: true, name: true },
    });

    const tenantIds = tenants.map(t => t.id);

    const owners = await this.prisma.user.findMany({
      where: { tenantId: { in: tenantIds }, role: UserRole.OWNER, isActive: true, email: { not: null } },
      select: { email: true, firstName: true },
    });

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#6366f1">${dto.subject}</h2>
      <div style="white-space:pre-wrap;color:#374151">${dto.body}</div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
      <p style="color:#9ca3af;font-size:12px">This message was sent by the RestroCloud platform team.</p>
    </div>`;

    let sent = 0;
    for (const owner of owners) {
      if (!owner.email) continue;
      await this.email.sendMail({ to: owner.email, subject: dto.subject, html }).catch(() => {});
      sent++;
    }

    const broadcast = await this.prisma.broadcast.create({
      data: {
        subject: dto.subject,
        body: dto.body,
        segment,
        recipientCount: sent,
        sentBy: actorEmail,
      },
    });

    await this.logAudit('BROADCAST_SENT', actorId, actorEmail, broadcast.id, dto.subject, { segment, recipientCount: sent });
    return broadcast;
  }

  // ─── SA-K System Administration ──────────────────────────────────────────

  async getErrorLog(limit = 50) {
    const entries = await this.redis.lrange('system:error:log', 0, limit - 1);
    return {
      count: entries.length,
      errors: entries.map(e => {
        try { return JSON.parse(e); } catch { return { raw: e }; }
      }),
    };
  }

  async getSystemHealthDetail() {
    // Redis info
    const redisInfo = await this.redis.info('all');
    const dbSize = await this.redis.dbsize();

    // Parse key Redis metrics from INFO output
    function parseInfo(raw: string): Record<string, string> {
      const out: Record<string, string> = {};
      for (const line of raw.split('\r\n')) {
        if (line.startsWith('#') || !line.includes(':')) continue;
        const [key, ...rest] = line.split(':');
        out[key.trim()] = rest.join(':').trim();
      }
      return out;
    }
    const ri = parseInfo(redisInfo);

    // DB table sizes via raw SQL
    const tableSizes = await this.prisma.$queryRaw<{ table_name: string; row_estimate: bigint; total_size: string }[]>`
      SELECT
        relname AS table_name,
        reltuples::BIGINT AS row_estimate,
        pg_size_pretty(pg_total_relation_size(oid)) AS total_size
      FROM pg_class
      WHERE relkind = 'r'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY pg_total_relation_size(oid) DESC
      LIMIT 20
    `;

    return {
      redis: {
        version: ri['redis_version'] ?? 'unknown',
        uptimeSeconds: Number(ri['uptime_in_seconds'] ?? 0),
        connectedClients: Number(ri['connected_clients'] ?? 0),
        usedMemoryHuman: ri['used_memory_human'] ?? 'unknown',
        maxMemoryHuman: ri['maxmemory_human'] ?? 'unlimited',
        hitRate: ri['keyspace_hits'] && ri['keyspace_misses']
          ? Math.round(
              (Number(ri['keyspace_hits']) /
                (Number(ri['keyspace_hits']) + Number(ri['keyspace_misses']))) * 100,
            )
          : null,
        totalKeys: dbSize,
        evictedKeys: Number(ri['evicted_keys'] ?? 0),
      },
      database: {
        tables: tableSizes.map(t => ({
          name: t.table_name,
          rowEstimate: Number(t.row_estimate),
          totalSize: t.total_size,
        })),
      },
    };
  }

  async gdprDeleteUser(customerEmail: string, actorId: string, actorEmail: string) {
    // Find customer by email
    const customer = await this.prisma.customer.findFirst({
      where: { email: customerEmail },
      select: { id: true, email: true, restaurantId: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with email ${customerEmail} not found`);
    }

    const anonymisedEmail = `deleted-${customer.id}@gdpr.removed`;

    await this.prisma.$transaction([
      // Anonymise the customer record
      this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          email: anonymisedEmail,
          phone: null,
          firstName: 'Deleted',
          lastName: 'User',
          dateOfBirth: null,
          notes: null,
        },
      }),
      // Anonymise delivery addresses on orders
      this.prisma.order.updateMany({
        where: { customerId: customer.id },
        data: { deliveryAddress: null, guestName: null, guestPhone: null },
      }),
      // Delete saved payment methods (PII)
      this.prisma.savedPaymentMethod.deleteMany({ where: { customerId: customer.id } }),
      // Delete customer notifications
      this.prisma.customerNotification.deleteMany({ where: { customerId: customer.id } }),
      // Delete reviews (PII content)
      this.prisma.review.deleteMany({ where: { customerId: customer.id } }),
    ]);

    await this.logAudit('GDPR_DELETE_USER', actorId, actorEmail, customer.id, customerEmail, {
      restaurantId: customer.restaurantId,
    });

    return { success: true, anonymisedId: customer.id, message: 'Customer PII has been anonymised per GDPR request' };
  }

  // ─── SA-J Analytics Intelligence ─────────────────────────────────────────

  async getCohortRetention() {
    // Each cohort = month tenant was created; active = had ≥1 order in that calendar month
    const tenants = await this.prisma.tenant.findMany({
      where: { slug: { not: 'restrocloud-platform' } },
      select: {
        id: true,
        createdAt: true,
        restaurants: { select: { id: true } },
      },
    });

    const restaurantToTenant: Record<string, { tenantId: string; cohortMonth: string }> = {};
    for (const t of tenants) {
      const cohortMonth = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
      for (const r of t.restaurants) {
        restaurantToTenant[r.id] = { tenantId: t.id, cohortMonth };
      }
    }

    // Get all completed orders grouped by restaurantId + month
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ['COMPLETED', 'SERVED', 'CLOSED'] as any } },
      select: { restaurantId: true, createdAt: true },
    });

    // Build: cohortMonth → activeMonth → Set of tenantIds
    const matrix: Record<string, Record<string, Set<string>>> = {};
    for (const o of orders) {
      const rInfo = restaurantToTenant[o.restaurantId];
      if (!rInfo) continue;
      const { tenantId, cohortMonth } = rInfo;
      const activeMonth = o.createdAt.toISOString().slice(0, 7);
      if (!matrix[cohortMonth]) matrix[cohortMonth] = {};
      if (!matrix[cohortMonth][activeMonth]) matrix[cohortMonth][activeMonth] = new Set();
      matrix[cohortMonth][activeMonth].add(tenantId);
    }

    // Count cohort sizes
    const cohortSizes: Record<string, number> = {};
    for (const t of tenants) {
      const cm = t.createdAt.toISOString().slice(0, 7);
      cohortSizes[cm] = (cohortSizes[cm] || 0) + 1;
    }

    const cohorts = Object.keys(cohortSizes).sort();
    const allMonths = [...new Set([
      ...Object.keys(cohortSizes),
      ...Object.values(matrix).flatMap(m => Object.keys(m)),
    ])].sort();

    return {
      cohorts: cohorts.map(cm => ({
        cohortMonth: cm,
        size: cohortSizes[cm],
        retention: allMonths
          .filter(am => am >= cm)
          .map(am => ({
            month: am,
            count: matrix[cm]?.[am]?.size ?? 0,
            pct: cohortSizes[cm] > 0
              ? Math.round(((matrix[cm]?.[am]?.size ?? 0) / cohortSizes[cm]) * 100)
              : 0,
          })),
      })),
      allMonths,
    };
  }

  async getFeatureAdoption() {
    const platformSlug = 'restrocloud-platform';

    // Count active tenants (exclude platform)
    const totalTenants = await this.prisma.tenant.count({
      where: { isActive: true, slug: { not: platformSlug } },
    });

    // For each feature module, count tenants with ≥1 usage
    const [
      tenantsWithOrders,
      tenantsWithDelivery,
      tenantsWithOnlineOrders,
      tenantsWithKDS,
      tenantsWithCRM,
      tenantsWithAggregator,
      tenantsWithInventory,
    ] = await Promise.all([
      // Orders: any order exists
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM orders o
        JOIN restaurants r ON r.id = o."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // Delivery: any Delivery record
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM deliveries d
        JOIN restaurants r ON r.id = d."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // Online orders: orders with cartToken
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM orders o
        JOIN restaurants r ON r.id = o."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE o."cartToken" IS NOT NULL AND t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // KDS: any order acknowledged (kitchenStatus changed)
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM orders o
        JOIN restaurants r ON r.id = o."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE o."kitchenStatus" != 'PENDING' AND t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // CRM: any customer exists
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM customers c
        JOIN restaurants r ON r.id = c."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // Aggregators: any aggregator connection
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM aggregator_connections ac
        JOIN restaurants r ON r.id = ac."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE t.slug != ${platformSlug} AND t."isActive" = true
      `,
      // Inventory: any ingredient
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT r."tenantId") as count
        FROM ingredients i
        JOIN restaurants r ON r.id = i."restaurantId"
        JOIN tenants t ON t.id = r."tenantId"
        WHERE t.slug != ${platformSlug} AND t."isActive" = true
      `,
    ]);

    function pct(rows: { count: bigint }[]) {
      const n = Number(rows[0]?.count ?? 0);
      return { count: n, pct: totalTenants > 0 ? Math.round((n / totalTenants) * 100) : 0 };
    }

    return {
      totalActiveTenants: totalTenants,
      features: [
        { name: 'POS / Orders', ...pct(tenantsWithOrders) },
        { name: 'Kitchen Display (KDS)', ...pct(tenantsWithKDS) },
        { name: 'Online Ordering', ...pct(tenantsWithOnlineOrders) },
        { name: 'Delivery', ...pct(tenantsWithDelivery) },
        { name: 'CRM / Loyalty', ...pct(tenantsWithCRM) },
        { name: 'Aggregators', ...pct(tenantsWithAggregator) },
        { name: 'Inventory', ...pct(tenantsWithInventory) },
      ],
    };
  }

  async getAtRiskTenants() {
    const platformSlug = 'restrocloud-platform';
    const now = new Date();
    const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day7Ago14 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000); // 14–21d window for comparison

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true, slug: { not: platformSlug } },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        trialEndsAt: true,
        createdAt: true,
        users: {
          where: { role: 'OWNER' as any },
          select: { email: true, lastLoginAt: true },
          take: 1,
        },
        restaurants: {
          select: {
            id: true,
            orders: {
              where: { createdAt: { gte: day30 } },
              select: { createdAt: true },
            },
          },
        },
      },
    });

    const atRisk = [];
    for (const t of tenants) {
      const signals: string[] = [];
      const owner = t.users[0];

      // Signal 1: No owner login in 14+ days
      if (owner?.lastLoginAt && owner.lastLoginAt < day14) {
        const daysAgo = Math.floor((now.getTime() - owner.lastLoginAt.getTime()) / (24 * 60 * 60 * 1000));
        signals.push(`No login for ${daysAgo}d`);
      } else if (!owner?.lastLoginAt) {
        signals.push('Owner never logged in');
      }

      // Signal 2: Trial expiring within 7 days
      if (t.trialEndsAt && t.trialEndsAt > now && t.trialEndsAt < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        const daysLeft = Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        signals.push(`Trial expires in ${daysLeft}d`);
      }

      // Signal 3: Declining order volume (this week vs prev week)
      const allOrders = t.restaurants.flatMap(r => r.orders);
      const thisWeek = allOrders.filter(o => o.createdAt >= day7).length;
      const prevWeek = allOrders.filter(o => o.createdAt >= day7Ago14 && o.createdAt < day7).length;
      if (prevWeek > 0 && thisWeek < prevWeek * 0.5) {
        signals.push(`Orders down ${Math.round((1 - thisWeek / prevWeek) * 100)}% this week`);
      } else if (t.createdAt < day14 && thisWeek === 0 && prevWeek === 0) {
        signals.push('No orders in 30 days');
      }

      if (signals.length > 0) {
        atRisk.push({
          tenantId: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          ownerEmail: owner?.email ?? null,
          lastLoginAt: owner?.lastLoginAt?.toISOString() ?? null,
          trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
          ordersThisWeek: thisWeek,
          ordersPrevWeek: prevWeek,
          signals,
        });
      }
    }

    // Sort by number of signals (most at-risk first)
    atRisk.sort((a, b) => b.signals.length - a.signals.length);
    return { count: atRisk.length, tenants: atRisk };
  }

  // ─── SA-L Marketing & Growth ──────────────────────────────────────────────

  async listReferralCodes() {
    return this.prisma.referralCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });
  }

  async createReferralCode(dto: CreateReferralCodeDto, actorId: string, actorEmail: string) {
    const existing = await this.prisma.referralCode.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Referral code ${dto.code} already exists`);

    const ref = await this.prisma.referralCode.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        discountPct: dto.discountPct,
        creditPct: dto.creditPct,
        maxUses: dto.maxUses,
        createdBy: actorEmail,
      },
    });
    await this.logAudit('REFERRAL_CODE_CREATED', actorId, actorEmail, ref.id, ref.code);
    return ref;
  }

  async toggleReferralCode(referralId: string, actorId: string, actorEmail: string) {
    const ref = await this.prisma.referralCode.findUnique({ where: { id: referralId } });
    if (!ref) throw new NotFoundException('Referral code not found');

    const updated = await this.prisma.referralCode.update({
      where: { id: referralId },
      data: { isActive: !ref.isActive },
    });
    await this.logAudit(
      updated.isActive ? 'REFERRAL_CODE_ACTIVATED' : 'REFERRAL_CODE_DEACTIVATED',
      actorId, actorEmail, ref.id, ref.code,
    );
    return updated;
  }

  async applyReferralCode(code: string, tenantId: string, actorId: string, actorEmail: string) {
    const ref = await this.prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { _count: { select: { usages: true } } },
    });
    if (!ref) throw new NotFoundException('Referral code not found');
    if (!ref.isActive) throw new BadRequestException('Referral code is inactive');
    if (ref.maxUses && ref._count.usages >= ref.maxUses) throw new BadRequestException('Referral code usage limit reached');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.prisma.$transaction([
      this.prisma.referralUsage.create({
        data: { referralCodeId: ref.id, referredTenantId: tenantId },
      }),
      this.prisma.referralCode.update({
        where: { id: ref.id },
        data: { usedCount: { increment: 1 } },
      }),
      // Apply credit to tenant
      ...(ref.creditPct > 0 ? [this.prisma.tenant.update({
        where: { id: tenantId },
        data: { creditBalance: { increment: ref.creditPct } },
      })] : []),
    ]);

    await this.logAudit('REFERRAL_CODE_APPLIED', actorId, actorEmail, ref.id, ref.code, { tenantId });
    return { success: true, discountPct: ref.discountPct, creditPct: ref.creditPct };
  }

  async listBanners() {
    return this.prisma.inAppBanner.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createBanner(dto: CreateBannerDto, actorId: string, actorEmail: string) {
    const banner = await this.prisma.inAppBanner.create({
      data: {
        title: dto.title,
        body: dto.body,
        ctaLabel: dto.ctaLabel,
        ctaUrl: dto.ctaUrl,
        targetPlan: dto.targetPlan,
        isActive: dto.isActive ?? true,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdBy: actorEmail,
      },
    });
    await this.logAudit('BANNER_CREATED', actorId, actorEmail, banner.id, banner.title);
    return banner;
  }

  async toggleBanner(bannerId: string, actorId: string, actorEmail: string) {
    const banner = await this.prisma.inAppBanner.findUnique({ where: { id: bannerId } });
    if (!banner) throw new NotFoundException('Banner not found');

    return this.prisma.inAppBanner.update({
      where: { id: bannerId },
      data: { isActive: !banner.isActive },
    });
  }

  async deleteBanner(bannerId: string, actorId: string, actorEmail: string) {
    const banner = await this.prisma.inAppBanner.findUnique({ where: { id: bannerId } });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.prisma.inAppBanner.delete({ where: { id: bannerId } });
    await this.logAudit('BANNER_DELETED', actorId, actorEmail, bannerId, banner.title);
    return { success: true };
  }

  async getMarketingStats() {
    const [
      totalReferralCodes,
      activeReferralCodes,
      totalReferralUsages,
      totalBanners,
      activeBanners,
      totalBroadcasts,
      totalBroadcastRecipients,
      couponRedemptions,
    ] = await Promise.all([
      this.prisma.referralCode.count(),
      this.prisma.referralCode.count({ where: { isActive: true } }),
      this.prisma.referralUsage.count(),
      this.prisma.inAppBanner.count(),
      this.prisma.inAppBanner.count({ where: { isActive: true } }),
      this.prisma.broadcast.count(),
      this.prisma.broadcast.aggregate({ _sum: { recipientCount: true } }),
      this.prisma.couponUsage.count(),
    ]);

    const topReferrals = await this.prisma.referralCode.findMany({
      orderBy: { usedCount: 'desc' },
      take: 5,
      select: { code: true, usedCount: true, discountPct: true, isActive: true },
    });

    return {
      referrals: {
        total: totalReferralCodes,
        active: activeReferralCodes,
        totalUsages: totalReferralUsages,
        topCodes: topReferrals,
      },
      banners: {
        total: totalBanners,
        active: activeBanners,
      },
      broadcasts: {
        total: totalBroadcasts,
        totalRecipients: totalBroadcastRecipients._sum.recipientCount ?? 0,
      },
      coupons: {
        totalRedemptions: couponRedemptions,
      },
    };
  }

  // ─── Plan Management ───────────────────────────────────────────────────────

  private readonly DEFAULT_PLANS: CreatePlanDto[] = [
    {
      tier: 'STARTER',
      name: 'Starter',
      priceMonthly: 49,
      priceAnnual: 470,
      currency: 'USD',
      maxLocations: 1,
      maxUsers: 5,
      sortOrder: 1,
      features: {
        kds: true, tables: true, pos: true, delivery: false, inventory: false,
        crm: false, analytics: false, aggregators: false, onlineOrdering: false,
        multiLocation: false, qrOrdering: true, customReports: false, apiAccess: false,
        whiteLabel: false, dedicatedSupport: false,
      },
    },
    {
      tier: 'GROWTH',
      name: 'Growth',
      priceMonthly: 129,
      priceAnnual: 1238,
      currency: 'USD',
      maxLocations: 3,
      maxUsers: 20,
      sortOrder: 2,
      features: {
        kds: true, tables: true, pos: true, delivery: true, inventory: true,
        crm: true, analytics: true, aggregators: false, onlineOrdering: true,
        multiLocation: true, qrOrdering: true, customReports: false, apiAccess: false,
        whiteLabel: false, dedicatedSupport: false,
      },
    },
    {
      tier: 'PRO',
      name: 'Pro',
      priceMonthly: 299,
      priceAnnual: 2870,
      currency: 'USD',
      maxLocations: -1,
      maxUsers: -1,
      sortOrder: 3,
      features: {
        kds: true, tables: true, pos: true, delivery: true, inventory: true,
        crm: true, analytics: true, aggregators: true, onlineOrdering: true,
        multiLocation: true, qrOrdering: true, customReports: true, apiAccess: true,
        whiteLabel: false, dedicatedSupport: false,
      },
    },
    {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      priceMonthly: 0,
      priceAnnual: 0,
      currency: 'USD',
      maxLocations: -1,
      maxUsers: -1,
      sortOrder: 4,
      features: {
        kds: true, tables: true, pos: true, delivery: true, inventory: true,
        crm: true, analytics: true, aggregators: true, onlineOrdering: true,
        multiLocation: true, qrOrdering: true, customReports: true, apiAccess: true,
        whiteLabel: true, dedicatedSupport: true,
      },
    },
  ];

  async seedDefaultPlansIfEmpty(): Promise<void> {
    const count = await this.prisma.plan.count();
    if (count > 0) return;
    for (const p of this.DEFAULT_PLANS) {
      await this.prisma.plan.upsert({
        where: { tier: p.tier },
        update: {},
        create: p as any,
      });
    }
    this.logger.log('Seeded 4 default plans');
  }

  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPlanConfig(dto: CreatePlanDto, actorId: string, actorEmail: string) {
    const existing = await this.prisma.plan.findUnique({ where: { tier: dto.tier } });
    if (existing) throw new ConflictException(`Plan for tier ${dto.tier} already exists`);
    const plan = await this.prisma.plan.create({ data: dto as any });
    await this.logAudit('PLAN_CREATED', actorId, actorEmail, plan.id, plan.name);
    return plan;
  }

  async updatePlanConfig(tier: string, dto: UpdatePlanConfigDto, actorId: string, actorEmail: string) {
    const plan = await this.prisma.plan.findUnique({ where: { tier: tier as any } });
    if (!plan) throw new NotFoundException(`Plan ${tier} not found`);
    const updated = await this.prisma.plan.update({ where: { tier: tier as any }, data: dto as any });
    await this.logAudit('PLAN_UPDATED', actorId, actorEmail, plan.id, plan.name);
    return updated;
  }

  async deletePlanConfig(tier: string, actorId: string, actorEmail: string) {
    const plan = await this.prisma.plan.findUnique({ where: { tier: tier as any } });
    if (!plan) throw new NotFoundException(`Plan ${tier} not found`);
    await this.prisma.plan.delete({ where: { tier: tier as any } });
    await this.logAudit('PLAN_DELETED', actorId, actorEmail, plan.id, plan.name);
  }
}
