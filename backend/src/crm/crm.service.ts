import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { UpsertLoyaltyConfigDto } from './dto/upsert-loyalty-config.dto';
import { CreateStampCardDto } from './dto/create-stamp-card.dto';
import { UpdateStampCardDto } from './dto/update-stamp-card.dto';
import { AddStampDto } from './dto/add-stamp.dto';
import { RedeemStampDto } from './dto/redeem-stamp.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { RecordPromoUsageDto } from './dto/record-promo-usage.dto';
import { SendCampaignDto } from './dto/send-campaign.dto';
import { CustomerSegmentQueryDto } from './dto/customer-segment-query.dto';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── M21.1 — Loyalty Config ──────────────────────────────────────────────────

  async getLoyaltyConfig(tenantId: string, restaurantId: string) {
    const config = await this.prisma.loyaltyConfig.findUnique({
      where: { restaurantId },
    });
    if (!config) {
      // Return defaults if no record exists
      return {
        tenantId,
        restaurantId,
        pointsPerSpend: 1,
        bronzeThreshold: 0,
        silverThreshold: 500,
        goldThreshold: 2000,
        platinumThreshold: 5000,
        pointsExpiryDays: null,
        isEnabled: true,
      };
    }
    return config;
  }

  async upsertLoyaltyConfig(
    tenantId: string,
    restaurantId: string,
    dto: UpsertLoyaltyConfigDto,
  ) {
    return this.prisma.loyaltyConfig.upsert({
      where: { restaurantId },
      create: {
        tenantId,
        restaurantId,
        ...dto,
      },
      update: { ...dto },
    });
  }

  // ─── M21.2 — Customer Segmentation ───────────────────────────────────────────

  private computeSegment(
    totalOrders: number,
    lastOrderDaysAgo: number | null,
    tier: string | null,
  ): string {
    if (totalOrders === 0) return 'NEW';
    if (lastOrderDaysAgo !== null && lastOrderDaysAgo > 90) return 'DORMANT';
    if (lastOrderDaysAgo !== null && lastOrderDaysAgo > 45) return 'AT_RISK';
    if (totalOrders >= 10 || tier === 'GOLD' || tier === 'PLATINUM') return 'VIP';
    if (totalOrders >= 3) return 'REGULAR';
    return 'NEW';
  }

  async listCustomersBySegment(
    tenantId: string,
    restaurantId: string,
    query: CustomerSegmentQueryDto,
  ) {
    const { segment, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.customer.findMany({
      where,
      include: {
        loyaltyAccount: { select: { points: true, tier: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const enriched = customers.map((c) => {
      const totalOrders = c._count.orders;
      const lastOrder = c.orders[0]?.createdAt ?? null;
      const lastOrderDaysAgo = lastOrder
        ? Math.floor((now - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const tier = c.loyaltyAccount?.tier ?? null;
      const seg = this.computeSegment(totalOrders, lastOrderDaysAgo, tier);

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        dateOfBirth: c.dateOfBirth,
        isBlacklisted: c.isBlacklisted,
        createdAt: c.createdAt,
        segment: seg,
        totalOrders,
        lastOrderAt: lastOrder?.toISOString() ?? null,
        loyaltyTier: tier,
        loyaltyPoints: c.loyaltyAccount?.points ?? 0,
      };
    });

    const filtered =
      segment && segment !== 'ALL'
        ? enriched.filter((c) => c.segment === segment)
        : enriched;

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return { customers: paginated, total, page, limit };
  }

  async getCustomerDetail(tenantId: string, restaurantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, restaurantId },
      include: {
        loyaltyAccount: {
          include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
        },
        addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        stampProgresses: {
          include: { stampCard: true },
        },
        _count: { select: { orders: true, promoCodeUsages: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // ─── M21.3 — Promo Codes ─────────────────────────────────────────────────────

  async createPromoCode(tenantId: string, restaurantId: string, dto: CreatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findFirst({
      where: { tenantId, restaurantId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Promo code "${dto.code}" already exists`);

    return this.prisma.promoCode.create({
      data: {
        tenantId,
        restaurantId,
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? 0,
        maxUses: dto.maxUses,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });
  }

  async listPromoCodes(tenantId: string, restaurantId: string) {
    return this.prisma.promoCode.findMany({
      where: { tenantId, restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePromoCode(
    tenantId: string,
    restaurantId: string,
    id: string,
    dto: Partial<CreatePromoCodeDto> & { isActive?: boolean },
  ) {
    await this._findPromoCode(tenantId, restaurantId, id);
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async deletePromoCode(tenantId: string, restaurantId: string, id: string) {
    await this._findPromoCode(tenantId, restaurantId, id);
    await this.prisma.promoCode.delete({ where: { id } });
    return { deleted: true };
  }

  async validatePromoCode(tenantId: string, restaurantId: string, dto: ValidatePromoDto) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { tenantId, restaurantId, code: dto.code.toUpperCase(), isActive: true },
    });
    if (!promo) return { valid: false, reason: 'Promo code not found or inactive' };

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      return { valid: false, reason: 'Promo code is not yet valid' };
    }
    if (promo.validUntil && now > promo.validUntil) {
      return { valid: false, reason: 'Promo code has expired' };
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, reason: 'Promo code usage limit reached' };
    }
    if (dto.orderAmount < promo.minOrderAmount) {
      return {
        valid: false,
        reason: `Minimum order amount is ${promo.minOrderAmount}`,
      };
    }

    let discountAmount = 0;
    if (promo.discountType === 'FLAT') {
      discountAmount = Math.min(promo.discountValue, dto.orderAmount);
    } else {
      discountAmount = (dto.orderAmount * promo.discountValue) / 100;
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      promoCodeId: promo.id,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
    };
  }

  async recordPromoUsage(
    tenantId: string,
    restaurantId: string,
    dto: RecordPromoUsageDto,
  ) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { tenantId, restaurantId, code: dto.code.toUpperCase() },
    });
    if (!promo) throw new NotFoundException('Promo code not found');

    await this.prisma.$transaction([
      this.prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      }),
      this.prisma.promoCodeUsage.create({
        data: {
          promoCodeId: promo.id,
          customerId: dto.customerId,
          orderId: dto.orderId,
        },
      }),
    ]);

    // Deactivate if max uses reached
    if (promo.maxUses !== null && promo.usedCount + 1 >= promo.maxUses) {
      await this.prisma.promoCode.update({
        where: { id: promo.id },
        data: { isActive: false },
      });
    }

    return { recorded: true };
  }

  // ─── M21.6 — Stamp Cards ─────────────────────────────────────────────────────

  async createStampCard(tenantId: string, restaurantId: string, dto: CreateStampCardDto) {
    return this.prisma.stampCard.create({
      data: { tenantId, restaurantId, ...dto },
    });
  }

  async listStampCards(tenantId: string, restaurantId: string) {
    return this.prisma.stampCard.findMany({
      where: { tenantId, restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStampCard(
    tenantId: string,
    restaurantId: string,
    id: string,
    dto: UpdateStampCardDto,
  ) {
    await this._findStampCard(tenantId, restaurantId, id);
    return this.prisma.stampCard.update({ where: { id }, data: dto });
  }

  async deleteStampCard(tenantId: string, restaurantId: string, id: string) {
    await this._findStampCard(tenantId, restaurantId, id);
    await this.prisma.stampCard.delete({ where: { id } });
    return { deleted: true };
  }

  async addStamp(tenantId: string, restaurantId: string, dto: AddStampDto) {
    const count = dto.count ?? 1;
    const card = await this._findStampCard(tenantId, restaurantId, dto.stampCardId);

    const progress = await this.prisma.stampProgress.upsert({
      where: { stampCardId_customerId: { stampCardId: dto.stampCardId, customerId: dto.customerId } },
      create: {
        tenantId,
        stampCardId: dto.stampCardId,
        customerId: dto.customerId,
        stamps: count,
        completedAt: count >= card.stampsRequired ? new Date() : null,
      },
      update: {
        stamps: { increment: count },
      },
    });

    // Set completedAt if stamps >= required (and not already completed)
    if (progress.stamps >= card.stampsRequired && !progress.completedAt) {
      await this.prisma.stampProgress.update({
        where: { id: progress.id },
        data: { completedAt: new Date() },
      });
    }

    const updated = await this.prisma.stampProgress.findUnique({
      where: { id: progress.id },
    });

    return {
      ...updated,
      isComplete: (updated!.stamps >= card.stampsRequired && !!updated!.completedAt),
    };
  }

  async redeemStamp(tenantId: string, restaurantId: string, dto: RedeemStampDto) {
    const progress = await this.prisma.stampProgress.findUnique({
      where: { stampCardId_customerId: { stampCardId: dto.stampCardId, customerId: dto.customerId } },
    });
    if (!progress) throw new NotFoundException('No stamp progress found');
    if (!progress.completedAt) throw new BadRequestException('Stamp card not yet completed');
    if (progress.redeemedAt) throw new BadRequestException('Reward already redeemed for this cycle');

    return this.prisma.stampProgress.update({
      where: { id: progress.id },
      data: {
        redeemedAt: new Date(),
        stamps: 0,
        completedAt: null,
      },
    });
  }

  async getStampProgress(tenantId: string, restaurantId: string, customerId: string) {
    const cards = await this.prisma.stampCard.findMany({
      where: { tenantId, restaurantId, isActive: true },
      include: {
        progresses: {
          where: { customerId },
        },
      },
    });

    return cards.map((card) => {
      const progress = card.progresses[0] ?? null;
      return {
        stampCard: {
          id: card.id,
          name: card.name,
          description: card.description,
          stampsRequired: card.stampsRequired,
          rewardDesc: card.rewardDesc,
          rewardValue: card.rewardValue,
          isActive: card.isActive,
        },
        stamps: progress?.stamps ?? 0,
        isComplete: progress ? (progress.stamps >= card.stampsRequired && !!progress.completedAt) : false,
        completedAt: progress?.completedAt ?? null,
        redeemedAt: progress?.redeemedAt ?? null,
      };
    });
  }

  // ─── M21.7 — Campaign Broadcasts ─────────────────────────────────────────────

  async createCampaign(tenantId: string, restaurantId: string, dto: SendCampaignDto) {
    return this.prisma.campaignBroadcast.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        channel: dto.channel,
        segment: dto.segment,
        subject: dto.subject,
        body: dto.body,
        status: 'DRAFT',
      },
    });
  }

  async listCampaigns(tenantId: string, restaurantId: string) {
    return this.prisma.campaignBroadcast.findMany({
      where: { tenantId, restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCampaign(tenantId: string, restaurantId: string, id: string) {
    const c = await this.prisma.campaignBroadcast.findFirst({
      where: { id, tenantId, restaurantId },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async sendCampaign(tenantId: string, restaurantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, restaurantId, campaignId);

    // Fetch matching customers
    const allCustomers = await this.listCustomersBySegment(tenantId, restaurantId, {
      limit: 1000,
      page: 1,
    });

    let targets = allCustomers.customers;
    if (campaign.segment !== 'ALL') {
      targets = targets.filter((c) => c.segment === campaign.segment);
    }

    let sentCount = 0;

    if (campaign.channel === 'EMAIL') {
      for (const customer of targets) {
        if (!customer.email) continue;
        try {
          await this.email.sendMail({
            to: customer.email,
            subject: campaign.subject ?? campaign.name,
            html: `<p>Hello ${customer.firstName},</p><p>${campaign.body}</p>`,
            text: campaign.body,
          });
          sentCount++;
        } catch (err) {
          this.logger.warn(`Failed to send campaign email to ${customer.email}: ${err.message}`);
        }
      }
    } else {
      // SMS / PUSH — mock: count eligible customers
      sentCount = targets.length;
    }

    return this.prisma.campaignBroadcast.update({
      where: { id: campaignId },
      data: { status: 'SENT', sentCount, sentAt: new Date() },
    });
  }

  // ─── M21.8 — Birthday Messages ───────────────────────────────────────────────

  async sendBirthdayMessages(tenantId: string, restaurantId: string): Promise<void> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const customers = await this.prisma.$queryRaw<
      Array<{ id: string; firstName: string; email: string | null }>
    >`
      SELECT id, "firstName", email
      FROM customers
      WHERE "tenantId" = ${tenantId}
        AND "restaurantId" = ${restaurantId}
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
        AND EXTRACT(DAY FROM "dateOfBirth") = ${day}
    `;

    for (const c of customers) {
      try {
        // Create CustomerNotification
        await this.prisma.customerNotification.create({
          data: {
            tenantId,
            restaurantId,
            customerId: c.id,
            type: 'BIRTHDAY',
            title: '🎂 Happy Birthday!',
            body: `Happy Birthday, ${c.firstName}! Enjoy a special treat from us today.`,
          },
        });
        // Send email if available
        if (c.email) {
          await this.email.sendMail({
            to: c.email,
            subject: `Happy Birthday, ${c.firstName}! 🎂`,
            html: `<p>Dear ${c.firstName},</p><p>Wishing you a wonderful birthday! Visit us today for a special surprise.</p>`,
          });
        }
      } catch (err) {
        this.logger.warn(`Birthday message failed for customer ${c.id}: ${err.message}`);
      }
    }
  }

  // ─── M21.9 — Re-engagement Messages ─────────────────────────────────────────

  async sendReengagementMessages(tenantId: string, restaurantId: string): Promise<void> {
    const allCustomers = await this.listCustomersBySegment(tenantId, restaurantId, {
      segment: 'DORMANT',
      limit: 500,
      page: 1,
    });

    for (const c of allCustomers.customers) {
      try {
        await this.prisma.customerNotification.create({
          data: {
            tenantId,
            restaurantId,
            customerId: c.id,
            type: 'RE_ENGAGEMENT',
            title: 'We miss you!',
            body: 'It has been a while. Come back and enjoy a special offer just for you.',
          },
        });
        if (c.email) {
          await this.email.sendMail({
            to: c.email,
            subject: 'We miss you! Come back for a special offer',
            html: `<p>Hi ${c.firstName},</p><p>We haven't seen you in a while and wanted to reach out. Come visit us and enjoy a special offer!</p>`,
          });
        }
      } catch (err) {
        this.logger.warn(`Re-engagement message failed for customer ${c.id}: ${err.message}`);
      }
    }
  }

  // ─── M21.10 — Review Moderation ──────────────────────────────────────────────

  async listReviews(
    tenantId: string,
    restaurantId: string,
    q: { isApproved?: string; page?: number; limit?: number },
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };
    if (q.isApproved !== undefined) {
      where.isApproved = q.isApproved === 'true';
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, total, page, limit };
  }

  async approveReview(tenantId: string, restaurantId: string, reviewId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, tenantId, restaurantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async rejectReview(tenantId: string, restaurantId: string, reviewId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, tenantId, restaurantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { deleted: true };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async _findPromoCode(tenantId: string, restaurantId: string, id: string) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { id, tenantId, restaurantId },
    });
    if (!promo) throw new NotFoundException('Promo code not found');
    return promo;
  }

  private async _findStampCard(tenantId: string, restaurantId: string, id: string) {
    const card = await this.prisma.stampCard.findFirst({
      where: { id, tenantId, restaurantId },
    });
    if (!card) throw new NotFoundException('Stamp card not found');
    return card;
  }
}
