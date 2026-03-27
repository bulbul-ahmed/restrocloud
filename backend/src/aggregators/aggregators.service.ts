import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AggregatorFactory } from './aggregator.factory';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { RejectAggregatorOrderDto } from './dto/reject-aggregator-order.dto';

@Injectable()
export class AggregatorsService {
  private readonly logger = new Logger(AggregatorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly factory: AggregatorFactory,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findConnection(tenantId: string, restaurantId: string, connectionId: string) {
    const conn = await this.prisma.aggregatorConnection.findFirst({
      where: { id: connectionId, tenantId, restaurantId },
    });
    if (!conn) throw new NotFoundException('Aggregator connection not found');
    return conn;
  }

  private async generateOrderNumber(restaurantId: string): Promise<string> {
    const key = `order:seq:${restaurantId}`;
    const num = await this.redis.incr(key);
    return `ORD-${String(num).padStart(5, '0')}`;
  }

  getSupportedPlatforms(): string[] {
    return this.factory.getSupportedPlatforms();
  }

  // ─── M17.17 Connection management ─────────────────────────────────────────

  async createConnection(
    tenantId: string,
    restaurantId: string,
    dto: CreateConnectionDto,
  ) {
    // Validate platform is supported
    this.factory.getAdapter(dto.platform);

    const existing = await this.prisma.aggregatorConnection.findFirst({
      where: { tenantId, restaurantId, platform: dto.platform.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException(
        `A connection for ${dto.platform} already exists for this restaurant. Update it instead.`,
      );
    }

    const conn = await this.prisma.aggregatorConnection.create({
      data: {
        tenantId,
        restaurantId,
        platform: dto.platform.toLowerCase(),
        displayName: dto.displayName,
        apiKey: dto.apiKey,
        apiSecret: dto.apiSecret,
        webhookSecret: dto.webhookSecret,
        commissionType: dto.commissionType ?? 'PERCENTAGE',
        commissionValue: dto.commissionValue ?? 0,
        autoAccept: dto.autoAccept ?? false,
      },
    });

    this.logger.log(`Aggregator connection created: ${dto.platform} for restaurant ${restaurantId}`);
    return conn;
  }

  async listConnections(tenantId: string, restaurantId: string) {
    return this.prisma.aggregatorConnection.findMany({
      where: { tenantId, restaurantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getConnection(tenantId: string, restaurantId: string, connectionId: string) {
    return this.findConnection(tenantId, restaurantId, connectionId);
  }

  async updateConnection(
    tenantId: string,
    restaurantId: string,
    connectionId: string,
    dto: UpdateConnectionDto,
  ) {
    await this.findConnection(tenantId, restaurantId, connectionId);
    return this.prisma.aggregatorConnection.update({
      where: { id: connectionId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
        ...(dto.apiSecret !== undefined && { apiSecret: dto.apiSecret }),
        ...(dto.webhookSecret !== undefined && { webhookSecret: dto.webhookSecret }),
        ...(dto.commissionType !== undefined && { commissionType: dto.commissionType }),
        ...(dto.commissionValue !== undefined && { commissionValue: dto.commissionValue }),
        ...(dto.autoAccept !== undefined && { autoAccept: dto.autoAccept }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteConnection(tenantId: string, restaurantId: string, connectionId: string) {
    await this.findConnection(tenantId, restaurantId, connectionId);
    await this.prisma.aggregatorConnection.delete({ where: { id: connectionId } });
    this.logger.log(`Aggregator connection deleted: ${connectionId}`);
    return { message: 'Aggregator connection deleted' };
  }

  async testConnection(tenantId: string, restaurantId: string, connectionId: string) {
    const conn = await this.findConnection(tenantId, restaurantId, connectionId);
    if (!conn.apiKey) {
      throw new BadRequestException('No API key configured for this connection');
    }
    const adapter = this.factory.getAdapter(conn.platform);
    const result = await adapter.testConnection(conn.apiKey, conn.apiSecret ?? undefined);

    // Update isConnected status based on test result
    await this.prisma.aggregatorConnection.update({
      where: { id: connectionId },
      data: { isConnected: result.success },
    });

    return result;
  }

  // ─── M17.16 Webhook order receipt ─────────────────────────────────────────

  async receiveWebhookOrder(
    platform: string,
    restaurantId: string,
    signature: string | undefined,
    rawPayload: any,
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isActive: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const conn = await this.prisma.aggregatorConnection.findFirst({
      where: { restaurantId, platform: platform.toLowerCase(), isActive: true },
    });
    if (!conn) {
      throw new NotFoundException(
        `No active ${platform} connection configured for this restaurant`,
      );
    }

    // Verify HMAC signature if webhookSecret is configured
    if (conn.webhookSecret && signature) {
      const adapter = this.factory.getAdapter(platform);
      const rawStr = JSON.stringify(rawPayload);
      const valid = adapter.verifyWebhook(rawStr, signature, conn.webhookSecret);
      if (!valid) {
        this.logger.warn(`Invalid webhook signature from ${platform} for restaurant ${restaurantId}`);
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    const adapter = this.factory.getAdapter(platform);
    const incoming = adapter.parseWebhookOrder(rawPayload);

    // Idempotency: skip duplicate orders
    const duplicate = await this.prisma.order.findFirst({
      where: { restaurantId, externalOrderId: incoming.externalOrderId },
    });
    if (duplicate) {
      this.logger.warn(
        `Duplicate aggregator order ${incoming.externalOrderId} from ${platform} — skipping`,
      );
      return { ...duplicate, duplicate: true };
    }

    const shouldAutoAccept = conn.autoAccept;
    const initialStatus = shouldAutoAccept ? OrderStatus.ACCEPTED : OrderStatus.PENDING;
    const orderNumber = await this.generateOrderNumber(restaurantId);

    // Build order items (no internal itemId — aggregator items are external)
    let subtotal = 0;
    const orderItemsData = incoming.items.map((item) => {
      const unitPrice = item.unitPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      // Encode modifier info in notes since we have no internal modifier IDs
      const modifierNote = (item.modifiers ?? [])
        .map((m) => `${m.name}${m.priceAdjustment !== 0 ? ` (+${m.priceAdjustment})` : ''}`)
        .join(', ');
      const notes = [item.notes, modifierNote].filter(Boolean).join(' | ');

      return {
        tenantId: restaurant.tenantId,
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: notes || undefined,
      };
    });

    // Use aggregator's total if provided (includes delivery fee, discounts, etc.)
    const totalAmount =
      incoming.totalAmount > 0 ? incoming.totalAmount : subtotal + incoming.deliveryFee;
    const taxAmount =
      Number(restaurant.taxRate) > 0 && !restaurant.taxInclusive
        ? subtotal * (Number(restaurant.taxRate) / 100)
        : 0;

    const order = await this.prisma.order.create({
      data: {
        tenantId: restaurant.tenantId,
        restaurantId,
        orderNumber,
        channel: OrderType.AGGREGATOR,
        status: initialStatus,
        guestName: incoming.customerName,
        guestPhone: incoming.customerPhone,
        notes: incoming.notes,
        deliveryAddress: incoming.deliveryAddress
          ? { line1: incoming.deliveryAddress }
          : undefined,
        subtotal,
        taxAmount,
        serviceCharge: 0,
        tipAmount: 0,
        discountAmount: 0,
        totalAmount,
        currency: incoming.currency ?? restaurant.currency,
        externalOrderId: incoming.externalOrderId,
        aggregatorName: platform.toLowerCase(),
        acceptedAt: shouldAutoAccept ? new Date() : undefined,
        items: {
          create: orderItemsData.map((oi) => ({
            tenantId: oi.tenantId,
            name: oi.name,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            totalPrice: oi.totalPrice,
            notes: oi.notes,
          })),
        },
        statusHistory: {
          create: {
            status: initialStatus,
            note: shouldAutoAccept
              ? `Auto-accepted from ${platform}`
              : `Received from ${platform}`,
          },
        },
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    // Update connection metadata
    await this.prisma.aggregatorConnection.update({
      where: { id: conn.id },
      data: { lastOrderAt: new Date(), isConnected: true },
    });

    // Emit realtime events
    this.realtime.emitNewOrder(restaurant.tenantId, restaurantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId,
      channel: OrderType.AGGREGATOR,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      totalAmount: Number(order.totalAmount),
      currency: restaurant.currency,
      createdAt: order.createdAt.toISOString(),
    });

    if (shouldAutoAccept) {
      this.realtime.emitOrderStatusChange(restaurant.tenantId, restaurantId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurantId,
        previousStatus: OrderStatus.PENDING,
        newStatus: OrderStatus.ACCEPTED,
        changedAt: new Date().toISOString(),
        note: 'Auto-accepted',
      });
    }

    this.logger.log(
      `Aggregator order received: ${incoming.externalOrderId} from ${platform} → ${orderNumber} (${initialStatus})`,
    );
    return order;
  }

  // ─── M17.9 Accept aggregator order ────────────────────────────────────────

  async acceptAggregatorOrder(tenantId: string, restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, restaurantId, channel: OrderType.AGGREGATOR },
    });
    if (!order) throw new NotFoundException('Aggregator order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order is ${order.status}. Only PENDING orders can be accepted.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ACCEPTED, acceptedAt: new Date() },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.ACCEPTED, note: 'Accepted by staff' },
      });
      return o;
    });

    // Push status to aggregator platform (non-blocking)
    if (order.aggregatorName && order.externalOrderId) {
      this.pushStatusToAggregator(
        restaurantId,
        order.aggregatorName,
        order.externalOrderId,
        'ACCEPTED',
      );
    }

    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId,
      previousStatus: OrderStatus.PENDING,
      newStatus: OrderStatus.ACCEPTED,
      changedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M17.9 Reject aggregator order ────────────────────────────────────────

  async rejectAggregatorOrder(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    dto: RejectAggregatorOrderDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, restaurantId, channel: OrderType.AGGREGATOR },
    });
    if (!order) throw new NotFoundException('Aggregator order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order is ${order.status}. Only PENDING orders can be rejected.`,
      );
    }

    const reason = dto.reasonText ?? dto.reasonCode ?? 'Rejected by staff';

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason,
          cancelledAt: new Date(),
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.CANCELLED,
          note: `Rejected: ${reason}`,
        },
      });
      return o;
    });

    // Push rejection to aggregator platform (non-blocking)
    if (order.aggregatorName && order.externalOrderId) {
      this.pushStatusToAggregator(
        restaurantId,
        order.aggregatorName,
        order.externalOrderId,
        'REJECTED',
        dto.reasonCode ?? reason,
      );
    }

    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId,
      previousStatus: OrderStatus.PENDING,
      newStatus: OrderStatus.CANCELLED,
      changedAt: new Date().toISOString(),
      note: reason,
    });

    return updated;
  }

  // ─── Private: push status to aggregator (non-blocking) ───────────────────

  private pushStatusToAggregator(
    restaurantId: string,
    platform: string,
    externalOrderId: string,
    status: string,
    reason?: string,
  ) {
    this.prisma.aggregatorConnection
      .findFirst({ where: { restaurantId, platform } })
      .then((conn) => {
        if (!conn?.apiKey) return;
        const adapter = this.factory.getAdapter(platform);
        return adapter.updateStatus(
          externalOrderId,
          status,
          conn.apiKey,
          conn.apiSecret ?? undefined,
          reason,
        );
      })
      .catch((e) =>
        this.logger.error(`Failed to push status to ${platform}: ${(e as Error).message}`),
      );
  }

  // ─── M17.12 / M17.4 / M17.7 Menu sync ────────────────────────────────────

  async syncMenuToConnection(tenantId: string, restaurantId: string, connectionId: string) {
    const conn = await this.findConnection(tenantId, restaurantId, connectionId);
    if (!conn.isActive) throw new BadRequestException('Connection is inactive');
    if (!conn.apiKey) throw new BadRequestException('No API key configured for this connection');

    const adapter = this.factory.getAdapter(conn.platform);

    const items = await this.prisma.item.findMany({
      where: { tenantId, restaurantId },
      include: { category: { select: { name: true } } },
    });

    const menuItems = items.map((item) => ({
      internalItemId: item.id,
      externalItemId: item.id,
      name: item.name,
      price: Number(item.price),
      isAvailable: item.isAvailable,
      categoryName: (item as any).category?.name,
    }));

    const result = await adapter.syncMenu(menuItems, conn.apiKey, conn.apiSecret ?? undefined);

    await this.prisma.aggregatorConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(
      `Menu synced to ${conn.platform}: ${result.synced} synced, ${result.failed} failed`,
    );
    return { ...result, platform: conn.platform, totalItems: items.length, syncedAt: new Date() };
  }

  async syncAllMenus(tenantId: string, restaurantId: string) {
    const connections = await this.prisma.aggregatorConnection.findMany({
      where: { tenantId, restaurantId, isActive: true },
    });

    if (connections.length === 0) {
      return { message: 'No active aggregator connections', results: [] };
    }

    const results = await Promise.allSettled(
      connections.map((conn) =>
        this.syncMenuToConnection(tenantId, restaurantId, conn.id),
      ),
    );

    return {
      results: results.map((r, i) => ({
        platform: connections[i].platform,
        ...(r.status === 'fulfilled'
          ? r.value
          : { error: (r.reason as Error).message, synced: 0, failed: 0 }),
      })),
    };
  }

  // ─── M17.13 Hours sync ────────────────────────────────────────────────────

  async syncHoursToConnection(tenantId: string, restaurantId: string, connectionId: string) {
    const conn = await this.findConnection(tenantId, restaurantId, connectionId);
    if (!conn.isActive) throw new BadRequestException('Connection is inactive');
    if (!conn.apiKey) throw new BadRequestException('No API key configured for this connection');

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const adapter = this.factory.getAdapter(conn.platform);
    const result = await adapter.syncHours(
      restaurant.operatingHours,
      conn.apiKey,
      conn.apiSecret ?? undefined,
    );

    this.logger.log(`Hours synced to ${conn.platform} for restaurant ${restaurantId}`);
    return { ...result, platform: conn.platform, syncedAt: new Date() };
  }

  // ─── M17.14 Commission tracking ───────────────────────────────────────────

  async getCommissionReport(
    tenantId: string,
    restaurantId: string,
    connectionId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const conn = await this.findConnection(tenantId, restaurantId, connectionId);

    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        restaurantId,
        channel: OrderType.AGGREGATOR,
        aggregatorName: conn.platform,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.READY, OrderStatus.SERVED] },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        createdAt: true,
        externalOrderId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const commissionRate = Number(conn.commissionValue);
    const isPercentage = conn.commissionType === 'PERCENTAGE';
    let totalRevenue = 0;
    let totalCommission = 0;

    const orderDetails = orders.map((o) => {
      const revenue = Number(o.totalAmount);
      const commission = isPercentage ? revenue * (commissionRate / 100) : commissionRate;
      totalRevenue += revenue;
      totalCommission += commission;
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        externalOrderId: o.externalOrderId,
        revenue: Number(revenue.toFixed(2)),
        commission: Number(commission.toFixed(2)),
        createdAt: o.createdAt,
      };
    });

    return {
      platform: conn.platform,
      displayName: conn.displayName ?? conn.platform,
      commissionType: conn.commissionType,
      commissionValue: commissionRate,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      totalOrders: orders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      netRevenue: Number((totalRevenue - totalCommission).toFixed(2)),
      orders: orderDetails,
    };
  }

  // ─── M17.15 Revenue comparison ────────────────────────────────────────────

  async getRevenueComparison(
    tenantId: string,
    restaurantId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const connections = await this.prisma.aggregatorConnection.findMany({
      where: { tenantId, restaurantId },
    });

    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const groups = await this.prisma.order.groupBy({
      by: ['aggregatorName'],
      where: {
        tenantId,
        restaurantId,
        channel: OrderType.AGGREGATOR,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.READY, OrderStatus.SERVED] },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const report = groups.map((g) => {
      const platform = g.aggregatorName ?? 'unknown';
      const conn = connections.find((c) => c.platform === platform);
      const revenue = Number(g._sum.totalAmount ?? 0);
      const commissionRate = Number(conn?.commissionValue ?? 0);
      const isPercentage = (conn?.commissionType ?? 'PERCENTAGE') === 'PERCENTAGE';
      const commission = isPercentage
        ? revenue * (commissionRate / 100)
        : commissionRate * (g._count.id ?? 0);

      return {
        platform,
        displayName: conn?.displayName ?? platform,
        totalOrders: g._count.id,
        totalRevenue: Number(revenue.toFixed(2)),
        totalCommission: Number(commission.toFixed(2)),
        netRevenue: Number((revenue - commission).toFixed(2)),
        commissionRate,
        commissionType: conn?.commissionType ?? 'PERCENTAGE',
      };
    });

    // Include connected platforms that have zero orders in the date range
    for (const conn of connections) {
      if (!report.find((r) => r.platform === conn.platform)) {
        report.push({
          platform: conn.platform,
          displayName: conn.displayName ?? conn.platform,
          totalOrders: 0,
          totalRevenue: 0,
          totalCommission: 0,
          netRevenue: 0,
          commissionRate: Number(conn.commissionValue),
          commissionType: conn.commissionType,
        });
      }
    }

    return {
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      platforms: report,
      summary: {
        totalRevenue: Number(report.reduce((s, p) => s + p.totalRevenue, 0).toFixed(2)),
        totalCommission: Number(report.reduce((s, p) => s + p.totalCommission, 0).toFixed(2)),
        totalOrders: report.reduce((s, p) => s + p.totalOrders, 0),
      },
    };
  }
}
