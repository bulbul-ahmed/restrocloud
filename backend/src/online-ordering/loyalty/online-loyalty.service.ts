import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SavePaymentMethodDto } from '../dto/save-payment-method.dto';

const LOYALTY_TIERS = [
  { tier: 'PLATINUM', min: 10000, next: null },
  { tier: 'GOLD',     min: 5000,  next: 10000 },
  { tier: 'SILVER',   min: 1000,  next: 5000 },
  { tier: 'BRONZE',   min: 0,     next: 1000 },
];

const VALID_GATEWAYS = ['stripe', 'sslcommerz', 'bkash', 'cod'];

@Injectable()
export class OnlineLoyaltyService {
  private readonly logger = new Logger(OnlineLoyaltyService.name);

  constructor(private prisma: PrismaService) {}

  // ─── M15.1 Auto-earn points when online order payment confirmed ──────────
  async autoEarnForOnlineOrder(
    tenantId: string,
    restaurantId: string,
    customerId: string | null,
    orderId: string,
    orderTotal: number,
    orderNumber: string,
  ): Promise<void> {
    if (!customerId) return; // guest order — no loyalty

    try {
      const account = await this.prisma.loyaltyAccount.findFirst({
        where: { customerId },
      });
      if (!account) return;

      const pts = Math.floor(orderTotal / 10);
      if (pts < 1) return;

      const newTotalEarned = account.totalEarned + pts;
      const newTier = LOYALTY_TIERS.find((t) => newTotalEarned >= t.min)?.tier ?? 'BRONZE';

      await this.prisma.$transaction([
        this.prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: { points: account.points + pts, totalEarned: newTotalEarned, tier: newTier },
        }),
        this.prisma.loyaltyTransaction.create({
          data: {
            tenantId,
            loyaltyAccountId: account.id,
            type: 'EARN',
            points: pts,
            description: `Online order ${orderNumber} — earned ${pts} pts`,
            orderId,
          },
        }),
      ]);

      // Customer notification
      await this.notifyCustomer(customerId, restaurantId, tenantId, 'LOYALTY_EARNED',
        `You earned ${pts} loyalty points!`,
        `${pts} points added for order ${orderNumber}. Total: ${account.points + pts} pts`,
        { pts, orderId });
    } catch (err) {
      this.logger.error(`autoEarn failed for order ${orderId}: ${err.message}`);
    }
  }

  // ─── M15.2 Redeem points at online checkout (internal — called in placeOnlineOrder) ─────
  async redeemForOnlineOrder(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    orderId: string,
    pointsToRedeem: number,
  ): Promise<number> {
    const account = await this.prisma.loyaltyAccount.findFirst({
      where: { customerId },
    });
    if (!account) throw new NotFoundException('Loyalty account not found');
    if (account.points < pointsToRedeem) {
      throw new BadRequestException(
        `Insufficient loyalty points. Available: ${account.points}, requested: ${pointsToRedeem}`,
      );
    }

    const discountValue = pointsToRedeem; // 1 point = 1 BDT

    await this.prisma.$transaction([
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: account.points - pointsToRedeem,
          totalRedeemed: account.totalRedeemed + pointsToRedeem,
        },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          tenantId,
          loyaltyAccountId: account.id,
          type: 'REDEEM',
          points: -pointsToRedeem,
          description: `Redeemed ${pointsToRedeem} pts — saved ৳${discountValue}`,
          orderId,
        },
      }),
    ]);

    // Customer notification
    await this.notifyCustomer(customerId, restaurantId, tenantId, 'LOYALTY_EARNED',
      `You used ${pointsToRedeem} loyalty points`,
      `Saved ৳${discountValue} on your order. Remaining: ${account.points - pointsToRedeem} pts`,
      { pointsRedeemed: pointsToRedeem, discountValue, orderId }).catch(() => {});

    return discountValue;
  }

  // ─── M15.5 Customer loyalty dashboard ───────────────────────────────────
  async getLoyaltyDashboard(customerId: string) {
    const account = await this.prisma.loyaltyAccount.findFirst({
      where: { customerId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!account) throw new NotFoundException('Loyalty account not found');

    const tierInfo = LOYALTY_TIERS.find((t) => t.tier === account.tier) ?? LOYALTY_TIERS[3];
    const nextTier = LOYALTY_TIERS.find((t) => (tierInfo.next ?? 0) <= t.min && t.tier !== account.tier);
    const pointsToNextTier = tierInfo.next ? Math.max(0, tierInfo.next - account.totalEarned) : 0;

    return {
      points: account.points,
      tier: account.tier,
      totalEarned: account.totalEarned,
      totalRedeemed: account.totalRedeemed,
      nextTierThreshold: tierInfo.next,
      pointsToNextTier,
      transactions: account.transactions,
    };
  }

  // ─── M15.8 Saved payment methods ────────────────────────────────────────
  async listSavedPaymentMethods(customerId: string, restaurantId: string) {
    return this.prisma.savedPaymentMethod.findMany({
      where: { customerId, restaurantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async savePaymentMethod(
    tenantId: string,
    customerId: string,
    restaurantId: string,
    dto: SavePaymentMethodDto,
  ) {
    if (!VALID_GATEWAYS.includes(dto.gateway)) {
      throw new BadRequestException(`Invalid gateway. Must be one of: ${VALID_GATEWAYS.join(', ')}`);
    }

    // Only one default per customer per restaurant
    if (dto.gateway === (await this.prisma.savedPaymentMethod.findFirst({
      where: { customerId, restaurantId, isDefault: true }, select: { gateway: true },
    }))?.gateway) {
      // already default — just upsert
    }

    return this.prisma.savedPaymentMethod.create({
      data: { tenantId, customerId, restaurantId, gateway: dto.gateway, label: dto.label ?? null },
    });
  }

  async deleteSavedPaymentMethod(customerId: string, methodId: string) {
    const method = await this.prisma.savedPaymentMethod.findFirst({
      where: { id: methodId, customerId },
    });
    if (!method) throw new NotFoundException('Saved payment method not found');
    await this.prisma.savedPaymentMethod.delete({ where: { id: methodId } });
    return { success: true };
  }

  async setDefaultPaymentMethod(customerId: string, restaurantId: string, methodId: string) {
    const method = await this.prisma.savedPaymentMethod.findFirst({
      where: { id: methodId, customerId },
    });
    if (!method) throw new NotFoundException('Saved payment method not found');

    await this.prisma.$transaction([
      this.prisma.savedPaymentMethod.updateMany({
        where: { customerId, restaurantId },
        data: { isDefault: false },
      }),
      this.prisma.savedPaymentMethod.update({
        where: { id: methodId },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.savedPaymentMethod.findUnique({ where: { id: methodId } });
  }

  // ─── M15.9 Customer notifications (create) ──────────────────────────────
  async notifyCustomer(
    customerId: string,
    restaurantId: string,
    tenantId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.customerNotification.create({
      data: { tenantId, customerId, restaurantId, type, title, body, data: data ?? undefined },
    });
  }

  // ─── M15.9 Customer notifications (list/mark-read) ──────────────────────
  async listCustomerNotifications(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.customerNotification.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customerNotification.count({ where: { customerId } }),
    ]);
    const unread = await this.prisma.customerNotification.count({
      where: { customerId, isRead: false },
    });
    return {
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread },
    };
  }

  async markNotificationRead(customerId: string, notifId: string) {
    const notif = await this.prisma.customerNotification.findFirst({
      where: { id: notifId, customerId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.customerNotification.update({
      where: { id: notifId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsRead(customerId: string) {
    const result = await this.prisma.customerNotification.updateMany({
      where: { customerId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
