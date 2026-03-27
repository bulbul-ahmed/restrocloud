import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  OrderType,
  RefundStatus,
  TransactionType,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OnlinePaymentGatewayService } from './online-payment-gateway.service';
import { OnlineLoyaltyService } from '../loyalty/online-loyalty.service';
import {
  InitiatePaymentDto,
  OnlinePaymentGateway,
} from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CustomerRefundRequestDto } from './dto/customer-refund.dto';
import { OnlinePaymentAnalyticsQueryDto } from './dto/online-payment-analytics-query.dto';

// Map UI gateway choice → existing PaymentMethod enum
const METHOD_MAP: Record<OnlinePaymentGateway, PaymentMethod> = {
  [OnlinePaymentGateway.STRIPE]:     PaymentMethod.ONLINE,
  [OnlinePaymentGateway.SSLCOMMERZ]: PaymentMethod.ONLINE,
  [OnlinePaymentGateway.BKASH]:      PaymentMethod.MOBILE_BANKING,
  [OnlinePaymentGateway.COD]:        PaymentMethod.CASH,
};

const ANALYTICS_CACHE_TTL = 300; // 5 min

@Injectable()
export class OnlinePaymentsService {
  private readonly logger = new Logger(OnlinePaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private gateway: OnlinePaymentGatewayService,
    private loyaltyService: OnlineLoyaltyService,
  ) {}

  // ─── Shared helper: resolve restaurant + validate order ownership ────────
  private async resolveOwnership(
    slug: string,
    orderId: string,
    cartToken?: string,
    customerId?: string,
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true, tenantId: true, name: true, currency: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const ownedByToken = cartToken && order.cartToken === cartToken;
    const ownedByCustomer = customerId && order.customerId === customerId;
    if (!ownedByToken && !ownedByCustomer) {
      throw new ForbiddenException('Access denied');
    }

    return { order, restaurant };
  }

  // ─── M14.1 Initiate payment ──────────────────────────────────────────────
  async initiatePayment(
    slug: string,
    orderId: string,
    dto: InitiatePaymentDto,
    customerId?: string,
  ) {
    const { order, restaurant } = await this.resolveOwnership(
      slug,
      orderId,
      dto.cartToken,
      customerId,
    );

    // Guard: no payment on cancelled/completed orders
    const badStatus = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];
    if ((badStatus as string[]).includes(order.status)) {
      throw new BadRequestException(`Cannot pay for a ${order.status} order`);
    }

    // Guard: double-payment prevention — auto-cancel stale PROCESSING
    const processing = (order.payments as any[]).find(
      (p) => p.status === PaymentStatus.PROCESSING,
    );
    if (processing) {
      const session = await this.prisma.onlinePaymentSession.findUnique({
        where: { paymentId: processing.id },
      });
      if (session && session.expiresAt > new Date()) {
        throw new ConflictException('A payment is already in progress for this order');
      }
      // Stale session — auto-cancel
      await this.prisma.payment.update({
        where: { id: processing.id },
        data: { status: PaymentStatus.CANCELLED },
      });
    }

    // Guard: already fully paid
    const alreadyPaid = (order.payments as any[])
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((s, p) => s + Number(p.amount), 0);
    if (alreadyPaid >= Number(order.totalAmount) - 0.001) {
      throw new BadRequestException('Order is already fully paid');
    }

    // ── COD path — record payment intent, order stays PENDING for staff to accept ──
    if (dto.method === OnlinePaymentGateway.COD) {
      const payment = await this.prisma.payment.create({
        data: {
          tenantId: restaurant.tenantId,
          restaurantId: restaurant.id,
          orderId,
          amount: order.totalAmount,
          currency: order.currency,
          method: PaymentMethod.CASH,
          status: PaymentStatus.PENDING,
          gatewayName: 'cod',
        },
      });

      // new_order socket event + DB notification already fired by createOrder()
      return { type: 'COD', payment, order };
    }

    // ── Gateway path ──────────────────────────────────────────────────────
    const gatewayName = dto.method.toLowerCase(); // 'stripe' | 'sslcommerz' | 'bkash'
    const amount = Number(order.totalAmount) - alreadyPaid;

    let sessionData: Record<string, any>;
    let gatewayTxId: string;

    if (dto.method === OnlinePaymentGateway.STRIPE) {
      const frontendUrl = process.env.FRONTEND_ORDERING_URL ?? 'http://localhost:3004';
      const successUrl =
        `${frontendUrl}/${slug}?stripe_success=1` +
        `&session_id={CHECKOUT_SESSION_ID}` +
        `&orderId=${orderId}` +
        `&cartToken=${dto.cartToken ?? ''}`;
      const cancelUrl = `${frontendUrl}/${slug}?stripe_cancel=1&orderId=${orderId}`;
      sessionData = await this.gateway.initiateStripe(
        amount, order.currency, orderId, restaurant.id, successUrl, cancelUrl,
      );
      // Use the real Checkout Session ID as gatewayTxId so we can confirm later
      gatewayTxId = (sessionData as any).checkoutSessionId ?? this.gateway.generateGatewayTxId(gatewayName);
    } else if (dto.method === OnlinePaymentGateway.SSLCOMMERZ) {
      sessionData = this.gateway.initiateSSLCommerz(
        amount,
        order.currency,
        orderId,
        restaurant.name,
      );
      gatewayTxId = this.gateway.generateGatewayTxId(gatewayName);
    } else {
      // BKASH
      sessionData = this.gateway.initiateBkash(amount, order.currency, orderId);
      gatewayTxId = this.gateway.generateGatewayTxId(gatewayName);
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: restaurant.tenantId,
          restaurantId: restaurant.id,
          orderId,
          amount,
          currency: order.currency,
          method: METHOD_MAP[dto.method],
          status: PaymentStatus.PROCESSING,
          gatewayName,
          gatewayTxId,
        },
      });
      const session = await tx.onlinePaymentSession.create({
        data: {
          tenantId: restaurant.tenantId,
          restaurantId: restaurant.id,
          orderId,
          paymentId: payment.id,
          gateway: gatewayName,
          sessionData,
          expiresAt,
        },
      });
      return { payment, session };
    });

    this.realtime.emitToTenant(restaurant.tenantId, 'online_payment_initiated', {
      orderId,
      paymentId: result.payment.id,
      gateway: gatewayName,
      amount,
    });

    return {
      type: 'GATEWAY',
      payment: result.payment,
      session: {
        gateway: gatewayName,
        expiresAt,
        ...sessionData,
      },
    };
  }

  // ─── M14.2 Confirm payment (public webhook/callback simulation) ──────────
  async confirmPayment(dto: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, gatewayTxId: dto.gatewayTxId },
      include: { order: true, onlineSession: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Idempotency guard
    if (payment.onlineSession?.webhookProcessed) {
      return { alreadyProcessed: true, status: payment.status };
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      return { alreadyProcessed: true, status: payment.status };
    }

    if (dto.status === 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(),
            gatewayResponse: { status: dto.status, confirmedAt: new Date().toISOString() },
          },
        });
        await tx.transaction.create({
          data: {
            tenantId: payment.tenantId,
            paymentId: payment.id,
            type: TransactionType.CHARGE,
            amount: payment.amount,
            currency: payment.currency,
            description: `${payment.gatewayName} payment confirmed for order ${(payment.order as any).orderNumber}`,
          },
        });
        await tx.order.update({
          where: { id: dto.orderId },
          data: { status: OrderStatus.ACCEPTED, acceptedAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: dto.orderId,
            status: OrderStatus.ACCEPTED,
            note: `Online payment confirmed via ${payment.gatewayName}`,
          },
        });
        if (payment.onlineSession) {
          await tx.onlinePaymentSession.update({
            where: { id: payment.onlineSession.id },
            data: { webhookProcessed: true },
          });
        }
      });

      // Fire new_order event (non-blocking)
      const order = payment.order as any;
      this.notifications
        .notify({
          tenantId: payment.tenantId,
          restaurantId: payment.restaurantId,
          type: NotificationType.NEW_ORDER,
          title: `New online order ${order.orderNumber}`,
          body: `${payment.currency} ${Number(payment.amount).toFixed(2)} paid via ${payment.gatewayName}`,
          data: { orderId: dto.orderId, orderNumber: order.orderNumber },
          targetRoles: [UserRole.MANAGER, UserRole.OWNER, UserRole.KITCHEN],
        })
        .catch((e) => this.logger.error(e.message));

      this.realtime.emitToTenant(payment.tenantId, 'online_payment_confirmed', {
        orderId: dto.orderId,
        paymentId: payment.id,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      // M15.1 Auto-earn loyalty points (non-blocking)
      this.loyaltyService.autoEarnForOnlineOrder(
        payment.tenantId, payment.restaurantId, (payment.order as any).customerId ?? null,
        dto.orderId, Number(payment.amount), (payment.order as any).orderNumber,
      ).catch(() => {});
    } else {
      // FAILED or CANCELLED
      const newStatus =
        dto.status === 'FAILED' ? PaymentStatus.FAILED : PaymentStatus.CANCELLED;
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newStatus, gatewayResponse: { status: dto.status } },
        });
        if (payment.onlineSession) {
          await tx.onlinePaymentSession.update({
            where: { id: payment.onlineSession.id },
            data: { webhookProcessed: true },
          });
        }
      });

      this.realtime.emitToTenant(payment.tenantId, 'online_payment_failed', {
        orderId: dto.orderId,
        paymentId: payment.id,
        status: newStatus,
      });
    }

    return {
      alreadyProcessed: false,
      status: dto.status === 'SUCCESS' ? PaymentStatus.COMPLETED : dto.status,
    };
  }

  // ─── M14.3 Get payment status ────────────────────────────────────────────
  async getPaymentStatus(
    slug: string,
    orderId: string,
    cartToken?: string,
    customerId?: string,
  ) {
    const { order, restaurant } = await this.resolveOwnership(
      slug,
      orderId,
      cartToken,
      customerId,
    );

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, restaurantId: restaurant.id },
      include: { onlineSession: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { hasPendingPayment: false, payment: null };
    }

    const expired =
      payment.onlineSession &&
      payment.onlineSession.expiresAt < new Date() &&
      payment.status === PaymentStatus.PROCESSING;

    return {
      hasPendingPayment: payment.status === PaymentStatus.PROCESSING && !expired,
      payment: {
        id: payment.id,
        method: payment.method,
        gatewayName: payment.gatewayName,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        expired,
        sessionData: payment.onlineSession?.sessionData ?? null,
      },
    };
  }

  // ─── M14.5 Customer-initiated refund request ─────────────────────────────
  async requestRefund(
    slug: string,
    orderId: string,
    dto: CustomerRefundRequestDto,
    customerId: string,
  ) {
    const { order, restaurant } = await this.resolveOwnership(
      slug,
      orderId,
      undefined,
      customerId,
    );

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Refunds can only be requested for COMPLETED orders');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: PaymentStatus.COMPLETED },
      include: { refunds: true },
    });
    if (!payment) throw new NotFoundException('No completed payment found for this order');

    // Only gateway payments can be refunded online
    if (!payment.gatewayName || payment.gatewayName === 'cod') {
      throw new BadRequestException(
        'COD orders cannot be refunded online. Please contact the restaurant.',
      );
    }

    // Prevent duplicate pending refunds
    const hasPendingRefund = payment.refunds.some(
      (r) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
    );
    if (hasPendingRefund) {
      throw new ConflictException('A refund request is already pending for this payment');
    }

    const refundable = Number(payment.amount) -
      payment.refunds
        .filter((r) => r.status === RefundStatus.COMPLETED)
        .reduce((s, r) => s + Number(r.amount), 0);

    if (refundable <= 0) {
      throw new BadRequestException('This payment has already been fully refunded');
    }

    const refund = await this.prisma.refund.create({
      data: {
        tenantId: restaurant.tenantId,
        paymentId: payment.id,
        amount: refundable,
        reason: dto.reason ?? 'Customer refund request',
        status: RefundStatus.PENDING,
      },
    });

    // Notify managers (non-blocking)
    this.notifications
      .notify({
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.id,
        type: NotificationType.REFUND_ISSUED,
        title: 'Refund request received',
        body: `Customer requested refund of ${restaurant.currency} ${refundable.toFixed(2)} for order ${(order as any).orderNumber}`,
        data: { refundId: refund.id, orderId, amount: refundable },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((e) => this.logger.error(e.message));

    this.realtime.emitToTenant(restaurant.tenantId, 'refund_requested', {
      refundId: refund.id,
      orderId,
      amount: refundable,
      reason: dto.reason,
    });

    return {
      refund,
      message: 'Refund request submitted for review. A manager will process it shortly.',
    };
  }

  // ─── M14.7 Customer payment history ─────────────────────────────────────
  async getCustomerPaymentHistory(
    customerId: string,
    restaurantId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { order: { customerId, restaurantId } },
        include: {
          order: {
            select: {
              orderNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              channel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({
        where: { order: { customerId, restaurantId } },
      }),
    ]);

    return {
      data: payments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Stripe Checkout confirm (called after Stripe redirect back) ─────────
  async confirmStripeCheckout(
    slug: string,
    orderId: string,
    sessionId: string,
    cartToken?: string,
    customerId?: string,
  ) {
    const { order, restaurant } = await this.resolveOwnership(
      slug, orderId, cartToken, customerId,
    );

    // Find the payment by orderId + Stripe session ID stored as gatewayTxId
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, gatewayTxId: sessionId },
      include: { order: true, onlineSession: true },
    });
    if (!payment) throw new NotFoundException('Payment session not found');

    // Idempotency guard
    if (payment.status === PaymentStatus.COMPLETED) {
      return { alreadyProcessed: true, status: PaymentStatus.COMPLETED };
    }

    // Verify with Stripe that the session is actually paid
    const verified = await this.gateway.verifyStripeSession(sessionId, restaurant.id);
    if (!verified) {
      throw new BadRequestException('Stripe payment not confirmed. Please contact support.');
    }

    // Mark payment complete
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
          gatewayResponse: { stripeSessionId: sessionId, confirmedAt: new Date().toISOString() },
        },
      });
      await tx.transaction.create({
        data: {
          tenantId: payment.tenantId,
          paymentId: payment.id,
          type: TransactionType.CHARGE,
          amount: payment.amount,
          currency: payment.currency,
          description: `Stripe Checkout confirmed for order ${(payment.order as any).orderNumber}`,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ACCEPTED, acceptedAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.ACCEPTED,
          note: 'Stripe Checkout payment confirmed',
        },
      });
      if (payment.onlineSession) {
        await tx.onlinePaymentSession.update({
          where: { id: payment.onlineSession.id },
          data: { webhookProcessed: true },
        });
      }
    });

    // Fire events (non-blocking)
    const orderData = payment.order as any;
    this.notifications
      .notify({
        tenantId: payment.tenantId,
        restaurantId: restaurant.id,
        type: NotificationType.NEW_ORDER,
        title: `New online order ${orderData.orderNumber}`,
        body: `${order.currency} ${Number(payment.amount).toFixed(2)} paid via Stripe`,
        data: { orderId, orderNumber: orderData.orderNumber },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER, UserRole.KITCHEN],
      })
      .catch((e) => this.logger.error(e.message));

    this.realtime.emitToTenant(payment.tenantId, 'online_payment_confirmed', {
      orderId,
      paymentId: payment.id,
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
    });

    this.loyaltyService.autoEarnForOnlineOrder(
      payment.tenantId, restaurant.id, orderData.customerId ?? null,
      orderId, Number(payment.amount), orderData.orderNumber,
    ).catch(() => {});

    return { alreadyProcessed: false, status: PaymentStatus.COMPLETED };
  }

  // ─── M14.10 Online payment analytics ─────────────────────────────────────
  async getOnlinePaymentAnalytics(
    tenantId: string,
    restaurantId: string,
    query: OnlinePaymentAnalyticsQueryDto,
  ) {
    const from = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 30 * 86400_000);
    const to = query.dateTo ? (() => { const d = new Date(query.dateTo!); d.setHours(23, 59, 59, 999); return d; })() : new Date();

    const cacheKey = `analytics:${restaurantId}:online-payments:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Identify online payments by presence of onlineSession (gateway) or COD gatewayName
    const [payments, ordersPlaced] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: {
          tenantId,
          restaurantId,
          createdAt: { gte: from, lte: to },
          OR: [
            { onlineSession: { isNot: null } },  // stripe / sslcommerz / bkash
            { gatewayName: 'cod' },              // COD online orders
          ],
        },
        select: {
          id: true,
          amount: true,
          status: true,
          gatewayName: true,
          createdAt: true,
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          restaurantId,
          createdAt: { gte: from, lte: to },
          cartToken: { not: null },  // online orders always have cartToken
        },
      }),
    ]);

    // Group by gateway
    const gateways = ['stripe', 'sslcommerz', 'bkash', 'cod'];
    const byGateway: Record<string, { count: number; amount: number; failed: number }> = {};
    for (const gw of gateways) {
      const gwPayments = payments.filter((p) => p.gatewayName === gw);
      byGateway[gw] = {
        count: gwPayments.length,
        amount: gwPayments
          .filter((p) => p.status === PaymentStatus.COMPLETED)
          .reduce((s, p) => s + Number(p.amount), 0),
        failed: gwPayments.filter((p) =>
          ([PaymentStatus.FAILED, PaymentStatus.CANCELLED] as string[]).includes(p.status),
        ).length,
      };
    }

    const ordersPaid = payments.filter((p) => p.status === PaymentStatus.COMPLETED).length;
    const failedCount = payments.filter((p) =>
      ([PaymentStatus.FAILED, PaymentStatus.CANCELLED] as string[]).includes(p.status),
    ).length;

    const result = {
      period: { from, to },
      byGateway,
      conversion: {
        ordersPlaced,
        ordersPaid,
        rate: ordersPlaced > 0 ? Math.round((ordersPaid / ordersPlaced) * 100 * 10) / 10 : 0,
      },
      failedPaymentRate:
        payments.length > 0
          ? Math.round((failedCount / payments.length) * 100 * 10) / 10
          : 0,
      totalRevenue: payments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .reduce((s, p) => s + Number(p.amount), 0),
    };

    await this.redis.set(cacheKey, JSON.stringify(result), ANALYTICS_CACHE_TTL);
    return result;
  }
}
