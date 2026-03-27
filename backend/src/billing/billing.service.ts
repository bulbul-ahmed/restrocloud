import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanTier, BillingCycle, SubStatus, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

const ANNUAL_DISCOUNT = 0.80; // 20% off (fallback if DB has no Plan record)

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── Get plan price from DB (falls back to 0 if Plan table empty) ────────

  private async getPlanPrice(tier: PlanTier): Promise<{ monthly: number; annual: number }> {
    const plan = await this.prisma.plan.findUnique({ where: { tier } }).catch(() => null);
    if (plan) return { monthly: plan.priceMonthly, annual: plan.priceAnnual };
    // Fallback hardcoded values (used during initial boot before seed)
    const fallback: Record<PlanTier, { monthly: number; annual: number }> = {
      STARTER:    { monthly: 49,  annual: 470 },
      GROWTH:     { monthly: 129, annual: 1238 },
      PRO:        { monthly: 299, annual: 2870 },
      ENTERPRISE: { monthly: 0,   annual: 0 },
    };
    return fallback[tier] ?? { monthly: 0, annual: 0 };
  }

  private async getAllPlanPrices() {
    const plans = await this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    const map: Record<string, { monthly: number; annual: number; features: string[] }> = {};
    for (const p of plans) {
      map[p.tier] = {
        monthly: p.priceMonthly,
        annual: p.priceAnnual,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      };
    }
    // ensure all tiers present
    for (const tier of ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'] as PlanTier[]) {
      if (!map[tier]) {
        const fb = await this.getPlanPrice(tier);
        map[tier] = { ...fb, features: [] };
      }
    }
    return map;
  }

  // ─── Ensure subscription record exists (called on first access) ───────────

  private async ensureSubscription(tenantId: string) {
    const existing = await this.prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (existing) return existing;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Determine initial status from tenant.trialEndsAt
    const now = new Date();
    const trialEnd = tenant.trialEndsAt ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const status: SubStatus = tenant.trialEndsAt && tenant.trialEndsAt > now
      ? 'TRIAL'
      : tenant.plan !== PlanTier.STARTER ? 'ACTIVE' : 'TRIAL';

    return this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        plan: tenant.plan,
        billingCycle: BillingCycle.MONTHLY,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    });
  }

  // ─── Get current subscription (self-service) ─────────────────────────────

  async getMySubscription(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { creditBalance: true, trialEndsAt: true },
    });

    const planPrices = await this.getAllPlanPrices();
    const prices = planPrices[sub.plan] ?? { monthly: 0, annual: 0 };
    const effectivePrice = sub.billingCycle === BillingCycle.ANNUAL
      ? prices.annual
      : prices.monthly;

    const planFeatures: Record<string, string[]> = {};
    for (const [tier, data] of Object.entries(planPrices)) {
      planFeatures[tier] = data.features;
    }

    return {
      ...sub,
      monthlyPrice: prices.monthly,
      effectivePrice,
      creditBalance: tenant?.creditBalance ?? 0,
      trialEndsAt: tenant?.trialEndsAt ?? null,
      planPrices,
      planFeatures,
    };
  }

  // ─── Upgrade / downgrade plan ─────────────────────────────────────────────

  async upgradePlan(tenantId: string, dto: UpgradePlanDto) {
    if (dto.plan === PlanTier.ENTERPRISE) {
      throw new BadRequestException('Contact sales for Enterprise plan');
    }

    const sub = await this.ensureSubscription(tenantId);
    const now = new Date();

    // Calculate new period end
    const periodEnd = dto.billingCycle === BillingCycle.ANNUAL
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const prices = await this.getPlanPrice(dto.plan);
    const invoiceAmount = dto.billingCycle === BillingCycle.ANNUAL
      ? prices.annual
      : prices.monthly;

    const [updatedSub] = await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: {
          plan: dto.plan,
          billingCycle: dto.billingCycle,
          status: SubStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: dto.plan },
      }),
      this.prisma.invoice.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          amount: invoiceAmount,
          currency: 'USD',
          status: InvoiceStatus.PAID,
          paidAt: now,
          dueAt: now,
          lineItems: {
            plan: dto.plan,
            billingCycle: dto.billingCycle,
            pricePerMonth: prices.monthly,
            total: invoiceAmount,
          },
        },
      }),
    ]);

    return updatedSub;
  }

  // ─── Cancel at period end ─────────────────────────────────────────────────

  async cancelSubscription(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId);

    if (sub.status === SubStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    return this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true },
    });
  }

  // ─── Undo cancellation ────────────────────────────────────────────────────

  async reactivateSubscription(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId);

    return this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: false },
    });
  }

  // ─── Pause subscription (up to 60 days) ───────────────────────────────────

  async pauseSubscription(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId);

    if (sub.status === SubStatus.TRIAL) throw new BadRequestException('Cannot pause a trial');
    if (sub.status === SubStatus.PAUSED) throw new BadRequestException('Already paused');
    if (sub.status === SubStatus.CANCELLED) throw new BadRequestException('Subscription is cancelled');

    return this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: SubStatus.PAUSED },
    });
  }

  // ─── Resume paused subscription ───────────────────────────────────────────

  async resumeSubscription(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId);

    if (sub.status !== SubStatus.PAUSED) {
      throw new BadRequestException('Subscription is not paused');
    }

    const now = new Date();
    const periodEnd = sub.billingCycle === BillingCycle.ANNUAL
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: SubStatus.ACTIVE, currentPeriodStart: now, currentPeriodEnd: periodEnd },
    });
  }

  // ─── Invoice history ──────────────────────────────────────────────────────

  async listInvoices(tenantId: string, page = 1, limit = 20) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where: { tenantId } }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ─── Cron: expire trials & mark PAST_DUE ─────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async expireTrialsAndBillDue() {
    const now = new Date();

    // 1. Expire TRIAL subscriptions where period has ended
    const expiredTrials = await this.prisma.tenantSubscription.findMany({
      where: { status: SubStatus.TRIAL, currentPeriodEnd: { lt: now } },
      include: { tenant: { select: { id: true, name: true, users: { where: { role: 'OWNER' }, select: { email: true, firstName: true } } } } },
    });

    for (const sub of expiredTrials) {
      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: SubStatus.PAST_DUE },
      });

      // Send trial expiry email to owner
      const owner = sub.tenant.users[0];
      if (owner) {
        await this.email.sendMail({
          to: owner.email,
          subject: 'Your RestroCloud trial has ended',
          html: `<p>Hi ${owner.firstName},</p><p>Your 14-day trial for <strong>${sub.tenant.name}</strong> has ended. Please upgrade to continue using all features.</p><p>Until then, your account is in read-only mode.</p>`,
        }).catch(() => {});
      }
    }

    // 2. Cancel subscriptions where cancelAtPeriodEnd=true and period ended
    await this.prisma.tenantSubscription.updateMany({
      where: { cancelAtPeriodEnd: true, currentPeriodEnd: { lt: now }, status: { not: SubStatus.CANCELLED } },
      data: { status: SubStatus.CANCELLED },
    });

    if (expiredTrials.length > 0) {
      this.logger.log(`Expired ${expiredTrials.length} trials`);
    }
  }

  // ─── Cron: send 3-day trial expiry warning ────────────────────────────────

  @Cron('0 9 * * *') // 9am daily
  async sendTrialExpiryWarnings() {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow  = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const expiringSoon = await this.prisma.tenantSubscription.findMany({
      where: { status: SubStatus.TRIAL, currentPeriodEnd: { gte: twoDaysFromNow, lte: threeDaysFromNow } },
      include: { tenant: { select: { name: true, users: { where: { role: 'OWNER' }, select: { email: true, firstName: true } } } } },
    });

    for (const sub of expiringSoon) {
      const owner = sub.tenant.users[0];
      if (!owner) continue;
      const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86400000);
      await this.email.sendMail({
        to: owner.email,
        subject: `Your RestroCloud trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        html: `<p>Hi ${owner.firstName},</p><p>Your free trial for <strong>${sub.tenant.name}</strong> expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Upgrade now to keep all your data and continue operating.</p>`,
      }).catch(() => {});
    }
  }
}
