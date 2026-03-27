import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, RefundStatus, TransactionType, UserRole, NotificationType, OrderStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { IssueRefundDto } from './dto/issue-refund.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
const CASHIER_ROLES: UserRole[] = [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
  ) {}

  // ─── M7.1 + M7.2 Process payment (single or split) ─────────────────────────

  async processPayment(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    userRole: UserRole,
    dto: ProcessPaymentDto,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId, tenantId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const nonPayable: string[] = ['CANCELLED', 'REFUNDED'];
    if (nonPayable.includes(order.status)) {
      throw new BadRequestException(`Cannot process payment for a ${order.status} order`);
    }

    // Calculate how much has already been paid (sum of COMPLETED payments)
    const alreadyPaid = order.payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const outstanding = Number(order.totalAmount) - alreadyPaid;

    if (outstanding <= 0) {
      // Order is fully paid — ensure it is marked COMPLETED (recovers orders stuck
      // in a non-terminal status if auto-complete previously failed).
      const nonTerminal = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
      if (!(nonTerminal as OrderStatus[]).includes(order.status as OrderStatus)) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
        });
        await this.prisma.orderStatusHistory.create({
          data: { orderId, status: OrderStatus.COMPLETED, note: 'Auto-completed (payment already collected)', changedBy: userId },
        });
      }
      return { alreadyPaid, outstanding: 0, isFullyPaid: true };
    }

    if (dto.amount > outstanding + 0.001) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding.toFixed(2)})`,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          restaurantId,
          orderId,
          amount: dto.amount,
          currency: order.currency,
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          gatewayName: dto.gatewayName ?? null,
          gatewayTxId: dto.gatewayTxId ?? null,
          paidAt: new Date(),
        },
      });

      // Create a CHARGE transaction record
      await tx.transaction.create({
        data: {
          tenantId,
          paymentId: newPayment.id,
          type: TransactionType.CHARGE,
          amount: dto.amount,
          currency: order.currency,
          description: `${dto.method} payment for order ${order.orderNumber}`,
          metadata: dto.notes ? { notes: dto.notes } : undefined,
        },
      });

      return newPayment;
    });

    const isFullyPaid = outstanding - dto.amount <= 0.001;

    // Auto-complete the order when fully paid, regardless of current kitchen status.
    // Payment collection is a cashier action that overrides the kitchen state machine.
    if (isFullyPaid) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.COMPLETED,
          note: `Auto-completed after full ${dto.method} payment`,
          changedBy: userId,
        },
      });
    }

    // Emit realtime event
    this.realtime.emitToTenant(tenantId, 'payment_processed', {
      paymentId: payment.id,
      orderId,
      restaurantId,
      amount: dto.amount,
      method: dto.method,
      alreadyPaid: alreadyPaid + dto.amount,
      outstanding: Math.max(0, outstanding - dto.amount),
      isFullyPaid,
      processedAt: payment.paidAt,
    });

    // Notify managers of payment received (non-blocking)
    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: `Payment received — ${dto.method}`,
        body: `${dto.amount.toFixed(2)} received for order #${orderId.slice(-6)}`,
        data: { paymentId: payment.id, orderId, amount: dto.amount, method: dto.method },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((err) => this.logger.error(`Notification error: ${err.message}`));

    return {
      ...payment,
      alreadyPaid: alreadyPaid + dto.amount,
      outstanding: Math.max(0, outstanding - dto.amount),
      isFullyPaid,
    };
  }

  // ─── M7.3 List payments for an order ────────────────────────────────────────

  async listOrderPayments(tenantId: string, restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId, tenantId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payments = await this.prisma.payment.findMany({
      where: { orderId, tenantId },
      include: { refunds: true, transactions: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      payments,
      summary: {
        totalAmount: Number(order.totalAmount),
        totalPaid,
        outstanding: Math.max(0, Number(order.totalAmount) - totalPaid),
        isFullyPaid: totalPaid >= Number(order.totalAmount) - 0.001,
      },
    };
  }

  // ─── M7.4 List all payments for restaurant ───────────────────────────────────

  async listPayments(tenantId: string, restaurantId: string, query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };
    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { refunds: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── M7.5 Get payment detail ─────────────────────────────────────────────────

  async getPayment(tenantId: string, restaurantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId, tenantId },
      include: {
        refunds: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { createdAt: 'asc' } },
        order: { select: { orderNumber: true, totalAmount: true, status: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ─── M7.6 Issue refund ───────────────────────────────────────────────────────

  async issueRefund(
    tenantId: string,
    restaurantId: string,
    paymentId: string,
    userRole: UserRole,
    dto: IssueRefundDto,
  ) {
    if (!MANAGER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: MANAGER');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId, tenantId },
      include: { refunds: true, order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const refundable: PaymentStatus[] = [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED];
    if (!refundable.includes(payment.status)) {
      throw new BadRequestException(
        `Cannot refund a payment with status: ${payment.status}`,
      );
    }

    const totalRefunded = payment.refunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const refundable_amount = Number(payment.amount) - totalRefunded;

    if (dto.amount > refundable_amount + 0.001) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds refundable balance (${refundable_amount.toFixed(2)})`,
      );
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const newRefund = await tx.refund.create({
        data: {
          tenantId,
          paymentId,
          amount: dto.amount,
          reason: dto.reason ?? null,
          status: RefundStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      // Transaction record
      await tx.transaction.create({
        data: {
          tenantId,
          paymentId,
          type: TransactionType.REFUND,
          amount: dto.amount,
          currency: payment.currency,
          description: dto.reason ?? `Refund for payment ${paymentId}`,
        },
      });

      // Update payment status
      const newTotalRefunded = totalRefunded + dto.amount;
      const newStatus =
        newTotalRefunded >= Number(payment.amount) - 0.001
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.payment.update({ where: { id: paymentId }, data: { status: newStatus } });

      return newRefund;
    });

    this.realtime.emitToTenant(tenantId, 'refund_issued', {
      refundId: refund.id,
      paymentId,
      restaurantId,
      orderId: payment.orderId,
      amount: dto.amount,
      reason: dto.reason,
      processedAt: refund.processedAt,
    });

    // Notify managers of refund (non-blocking)
    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.REFUND_ISSUED,
        title: `Refund issued — ${dto.amount.toFixed(2)}`,
        body: dto.reason ? `Reason: ${dto.reason}` : `Refund processed for payment ${paymentId.slice(-6)}`,
        data: { refundId: refund.id, paymentId, amount: dto.amount, reason: dto.reason },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((err) => this.logger.error(`Notification error: ${err.message}`));

    return refund;
  }

  // ─── M7.7 Cancel payment ─────────────────────────────────────────────────────

  async cancelPayment(
    tenantId: string,
    restaurantId: string,
    paymentId: string,
    userRole: UserRole,
  ) {
    if (!MANAGER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: MANAGER');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId, tenantId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const cancellable: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.PROCESSING];
    if (!cancellable.includes(payment.status)) {
      throw new BadRequestException(
        `Cannot cancel a payment with status: ${payment.status}`,
      );
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  // ─── M7.8 List refunds for a payment ────────────────────────────────────────

  async listRefunds(tenantId: string, restaurantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId, tenantId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    return this.prisma.refund.findMany({
      where: { paymentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── M14.4 Staff confirm COD payment collected ───────────────────────────────

  async confirmCodPayment(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userRole: UserRole,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId, tenantId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const codPayment = (order.payments as any[]).find(
      (p) => p.gatewayName === 'cod' && p.status === PaymentStatus.COMPLETED,
    );
    if (!codPayment) {
      throw new BadRequestException('No completed COD payment found for this order');
    }

    const completable = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY];
    if (!(completable as string[]).includes(order.status)) {
      throw new BadRequestException(`Order cannot be confirmed from ${order.status} status`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.COMPLETED, note: 'COD payment confirmed by staff' },
      });
      return updatedOrder;
    });

    this.realtime.emitToTenant(tenantId, 'order_completed', {
      orderId,
      restaurantId,
      orderNumber: (order as any).orderNumber,
      confirmedAt: new Date(),
    });

    return { order: updated, payment: codPayment, message: 'COD payment confirmed. Order marked as completed.' };
  }

  // ─── M14.6 Staff approve online refund request ───────────────────────────────

  async approveOnlineRefund(
    tenantId: string,
    restaurantId: string,
    paymentId: string,
    refundId: string,
    userRole: UserRole,
  ) {
    if (!MANAGER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: MANAGER');
    }

    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, paymentId, tenantId },
      include: { payment: { include: { refunds: true } } },
    });
    if (!refund) throw new NotFoundException('Refund request not found');

    if (refund.payment.restaurantId !== restaurantId) {
      throw new ForbiddenException('Access denied');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(`Refund is already in ${refund.status} status`);
    }

    const completedRefunds = refund.payment.refunds
      .filter((r) => r.id !== refundId && r.status === RefundStatus.COMPLETED)
      .reduce((s, r) => s + Number(r.amount), 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const approved = await tx.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.COMPLETED, processedAt: new Date() },
      });
      await tx.transaction.create({
        data: {
          tenantId,
          paymentId,
          type: TransactionType.REFUND,
          amount: refund.amount,
          currency: refund.payment.currency,
          description: refund.reason ?? `Approved refund for payment ${paymentId}`,
        },
      });
      const newTotalRefunded = completedRefunds + Number(refund.amount);
      const newStatus =
        newTotalRefunded >= Number(refund.payment.amount) - 0.001
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await tx.payment.update({ where: { id: paymentId }, data: { status: newStatus } });
      return approved;
    });

    this.realtime.emitToTenant(tenantId, 'refund_issued', {
      refundId,
      paymentId,
      restaurantId,
      amount: Number(refund.amount),
      processedAt: result.processedAt,
    });

    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.REFUND_ISSUED,
        title: `Refund approved — ${Number(refund.amount).toFixed(2)}`,
        body: refund.reason ?? `Refund approved for payment ${paymentId.slice(-6)}`,
        data: { refundId, paymentId, amount: Number(refund.amount) },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((err) => this.logger.error(`Notification error: ${err.message}`));

    return result;
  }

  // ─── M7.9 Payment summary (daily/date-range breakdown) ───────────────────────

  async getPaymentSummary(tenantId: string, restaurantId: string, query: { dateFrom?: string; dateTo?: string }) {
    // Include all payments that were successfully processed at any point
    const processedStatuses: PaymentStatus[] = [
      PaymentStatus.COMPLETED,
      PaymentStatus.PARTIALLY_REFUNDED,
      PaymentStatus.REFUNDED,
    ];

    const where: any = {
      tenantId,
      restaurantId,
      status: { in: processedStatuses },
    };

    // Default to today if no date provided
    const from = query.dateFrom ? new Date(query.dateFrom) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = query.dateTo ? new Date(query.dateTo) : new Date(new Date().setHours(23, 59, 59, 999));
    if (!query.dateTo) to.setHours(23, 59, 59, 999);
    where.createdAt = { gte: from, lte: to };

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        refunds: { where: { status: RefundStatus.COMPLETED } },
      },
    });

    // Breakdown by method
    const methods: PaymentMethod[] = ['CASH', 'CARD', 'MOBILE_BANKING', 'ONLINE', 'WALLET', 'CREDIT'];
    const byMethod = methods.map((method) => {
      const methodPayments = payments.filter((p) => p.method === method);
      const gross = methodPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const refunded = methodPayments.reduce(
        (sum, p) => sum + p.refunds.reduce((s, r) => s + Number(r.amount), 0),
        0,
      );
      return { method, count: methodPayments.length, gross, refunded, net: gross - refunded };
    });

    const totalGross = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunded = payments.reduce(
      (sum, p) => sum + p.refunds.reduce((s, r) => s + Number(r.amount), 0),
      0,
    );

    return {
      dateFrom: from,
      dateTo: to,
      totalTransactions: payments.length,
      totalGross,
      totalRefunded,
      totalNet: totalGross - totalRefunded,
      byMethod: byMethod.filter((m) => m.count > 0),
    };
  }
}
