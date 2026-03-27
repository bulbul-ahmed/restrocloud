import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { KitchenStatus, OrderStatus, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KdsQueueQueryDto } from './dto/kds-queue-query.dto';
import { KdsHistoryQueryDto } from './dto/kds-history-query.dto';

// Active order statuses shown on KDS
const KDS_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

// Kitchen statuses that count as "in progress" (not done)
const KDS_ACTIVE_ITEM_STATUSES: KitchenStatus[] = [
  KitchenStatus.QUEUED,
  KitchenStatus.ACKNOWLEDGED,
  KitchenStatus.PREPARING,
  KitchenStatus.READY,
];

function deriveOverallKitchenStatus(statuses: KitchenStatus[]): KitchenStatus {
  if (statuses.length === 0) return KitchenStatus.QUEUED;
  if (statuses.every((s) => s === KitchenStatus.SERVED)) return KitchenStatus.SERVED;
  if (statuses.every((s) => s === KitchenStatus.READY || s === KitchenStatus.SERVED)) {
    return KitchenStatus.READY;
  }
  if (statuses.some((s) => s === KitchenStatus.PREPARING)) return KitchenStatus.PREPARING;
  if (statuses.some((s) => s === KitchenStatus.ACKNOWLEDGED)) return KitchenStatus.ACKNOWLEDGED;
  return KitchenStatus.QUEUED;
}

@Injectable()
export class KdsService {
  private readonly logger = new Logger(KdsService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
  ) {}

  // ─── M6.1 + M6.10 KDS Queue view (with station filter) ───────────────────

  async getQueue(tenantId: string, restaurantId: string, query: KdsQueueQueryDto) {
    const { status, channel, categoryId, limit = 50 } = query;

    const itemWhere: any = { isVoid: false };
    if (categoryId) {
      itemWhere.item = { categoryId };
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        restaurantId,
        status: { in: KDS_ACTIVE_ORDER_STATUSES },
        ...(channel && { channel }),
        // Only show orders that have at least one active kitchen item
        items: {
          some: {
            isVoid: false,
            kitchenStatus: { in: KDS_ACTIVE_ITEM_STATUSES },
            ...(categoryId && { item: { categoryId } }),
            ...(status && { kitchenStatus: status }),
          },
        },
      },
      include: {
        items: {
          where: itemWhere,
          include: { modifiers: true },
          orderBy: { createdAt: 'asc' },
        },
        table: { select: { tableNumber: true, id: true } },
      },
      orderBy: { createdAt: 'asc' }, // oldest first on KDS
      take: limit,
    });

    const now = Date.now();

    return orders.map((order) => {
      const activeItems = order.items.filter((i) => !i.isVoid);
      const itemStatuses = activeItems.map((i) => i.kitchenStatus);
      const overallKitchenStatus = deriveOverallKitchenStatus(itemStatuses);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        channel: order.channel,
        orderStatus: order.status,
        overallKitchenStatus,
        tableNumber: order.table?.tableNumber ?? null,
        elapsedSeconds: Math.floor((now - order.createdAt.getTime()) / 1000),
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        notes: order.notes,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
          kitchenStatus: item.kitchenStatus,
          isVoid: item.isVoid,
          modifiers: item.modifiers.map((m) => ({ name: m.name })),
        })),
      };
    });
  }

  // ─── M6.2 Acknowledge order ───────────────────────────────────────────────

  async acknowledgeOrder(tenantId: string, restaurantId: string, orderId: string, userId: string) {
    await this.requireOrder(tenantId, restaurantId, orderId);

    const { count } = await this.prisma.orderItem.updateMany({
      where: { orderId, tenantId, isVoid: false, kitchenStatus: KitchenStatus.QUEUED },
      data: { kitchenStatus: KitchenStatus.ACKNOWLEDGED },
    });

    if (count === 0) {
      throw new BadRequestException('No QUEUED items to acknowledge on this order');
    }

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: '',
      restaurantId,
      status: KitchenStatus.ACKNOWLEDGED,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`KDS acknowledge: order ${orderId} (${count} items)`);
    return { acknowledged: count };
  }

  // ─── M6.3 Start cooking (→ PREPARING) ────────────────────────────────────

  async startOrder(tenantId: string, restaurantId: string, orderId: string, userId: string) {
    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const { count } = await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        tenantId,
        isVoid: false,
        kitchenStatus: { in: [KitchenStatus.QUEUED, KitchenStatus.ACKNOWLEDGED] },
      },
      data: { kitchenStatus: KitchenStatus.PREPARING },
    });

    if (count === 0) {
      throw new BadRequestException('No QUEUED or ACKNOWLEDGED items to start on this order');
    }

    // Auto-advance order to ACCEPTED if still PENDING
    if (order.status === OrderStatus.PENDING) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ACCEPTED,
          acceptedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.ACCEPTED, note: 'Kitchen started cooking', changedBy: userId },
          },
        },
      });
    }

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: '',
      restaurantId,
      status: KitchenStatus.PREPARING,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`KDS start: order ${orderId} (${count} items → PREPARING)`);
    return { started: count };
  }

  // ─── M6.4 Mark individual item ready ─────────────────────────────────────

  async markItemReady(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    itemId: string,
    userId: string,
  ) {
    await this.requireOrder(tenantId, restaurantId, orderId);

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId, isVoid: false },
    });
    if (!item) throw new NotFoundException('Order item not found');

    if (item.kitchenStatus === KitchenStatus.READY) {
      return { message: 'Item is already READY', item };
    }
    if (item.kitchenStatus === KitchenStatus.SERVED) {
      throw new BadRequestException('Cannot mark a SERVED item as READY');
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { kitchenStatus: KitchenStatus.READY },
    });

    // Check if all items are now READY or SERVED → auto-bump order to READY
    const pendingCount = await this.prisma.orderItem.count({
      where: {
        orderId,
        tenantId,
        isVoid: false,
        kitchenStatus: {
          notIn: [KitchenStatus.READY, KitchenStatus.SERVED, KitchenStatus.CANCELLED],
        },
      },
    });

    if (pendingCount === 0) {
      await this.autoBumpOrderReady(tenantId, restaurantId, orderId, userId);
    }

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: itemId,
      restaurantId,
      status: KitchenStatus.READY,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M6.5 Bump entire order ready ────────────────────────────────────────

  async bumpOrderReady(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
  ) {
    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const { count } = await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        tenantId,
        isVoid: false,
        kitchenStatus: {
          notIn: [KitchenStatus.READY, KitchenStatus.SERVED, KitchenStatus.CANCELLED],
        },
      },
      data: { kitchenStatus: KitchenStatus.READY },
    });

    await this.autoBumpOrderReady(tenantId, restaurantId, orderId, userId);

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: '',
      restaurantId,
      status: KitchenStatus.READY,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`KDS bump ready: order #${order.orderNumber} (${count} items)`);
    return { bumped: count, orderNumber: order.orderNumber };
  }

  // ─── M6.6 Mark individual item served ────────────────────────────────────

  async markItemServed(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    itemId: string,
  ) {
    await this.requireOrder(tenantId, restaurantId, orderId);

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId, isVoid: false },
    });
    if (!item) throw new NotFoundException('Order item not found');

    if (item.kitchenStatus !== KitchenStatus.READY) {
      throw new BadRequestException(`Item must be READY before marking as SERVED (current: ${item.kitchenStatus})`);
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { kitchenStatus: KitchenStatus.SERVED },
    });

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: itemId,
      restaurantId,
      status: KitchenStatus.SERVED,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M6.7 Bump entire order served ───────────────────────────────────────

  async bumpOrderServed(
    tenantId: string,
    restaurantId: string,
    orderId: string,
  ) {
    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const { count } = await this.prisma.orderItem.updateMany({
      where: { orderId, tenantId, isVoid: false, kitchenStatus: KitchenStatus.READY },
      data: { kitchenStatus: KitchenStatus.SERVED },
    });

    if (count === 0) {
      throw new BadRequestException('No READY items to mark as served on this order');
    }

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: '',
      restaurantId,
      status: KitchenStatus.SERVED,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`KDS bump served: order #${order.orderNumber} (${count} items)`);
    return { served: count, orderNumber: order.orderNumber };
  }

  // ─── M6.8 KDS History ────────────────────────────────────────────────────

  async getHistory(tenantId: string, restaurantId: string, query: KdsHistoryQueryDto) {
    const { limit = 20 } = query;

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        restaurantId,
        status: { in: [OrderStatus.READY, OrderStatus.COMPLETED] },
        readyAt: { not: null },
      },
      include: {
        items: {
          where: { isVoid: false },
          orderBy: { createdAt: 'asc' },
        },
        table: { select: { tableNumber: true } },
      },
      orderBy: { readyAt: 'desc' },
      take: limit,
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      channel: order.channel,
      orderStatus: order.status,
      tableNumber: order.table?.tableNumber ?? null,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
      prepSeconds: order.readyAt && order.acceptedAt
        ? Math.floor((order.readyAt.getTime() - order.acceptedAt.getTime()) / 1000)
        : null,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        kitchenStatus: i.kitchenStatus,
      })),
    }));
  }

  // ─── M6.9 KDS Stats ──────────────────────────────────────────────────────

  async getStats(tenantId: string, restaurantId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayOrderCount, activeItemsByStatus, completedTodayWithTimes] = await Promise.all([
      // Total orders today
      this.prisma.order.count({
        where: { tenantId, restaurantId, createdAt: { gte: todayStart } },
      }),

      // Active items grouped by kitchen status (across all active orders)
      this.prisma.orderItem.groupBy({
        by: ['kitchenStatus'],
        where: {
          tenantId,
          isVoid: false,
          order: {
            restaurantId,
            status: { in: KDS_ACTIVE_ORDER_STATUSES },
          },
        },
        _count: { id: true },
      }),

      // Orders completed today with timing data for avg prep time
      this.prisma.order.findMany({
        where: {
          tenantId,
          restaurantId,
          createdAt: { gte: todayStart },
          readyAt: { not: null },
          acceptedAt: { not: null },
        },
        select: { acceptedAt: true, readyAt: true },
        take: 200,
      }),
    ]);

    // Compute avg prep time (acceptedAt → readyAt) in seconds
    const avgPrepSeconds =
      completedTodayWithTimes.length > 0
        ? Math.round(
            completedTodayWithTimes.reduce(
              (sum, o) => sum + (o.readyAt!.getTime() - o.acceptedAt!.getTime()),
              0,
            ) /
              completedTodayWithTimes.length /
              1000,
          )
        : null;

    // Shape grouped items into a flat map
    const itemsByStatus: Record<string, number> = {};
    for (const group of activeItemsByStatus) {
      itemsByStatus[group.kitchenStatus] = group._count.id;
    }

    return {
      today: {
        totalOrders: todayOrderCount,
        completedWithTiming: completedTodayWithTimes.length,
        avgPrepSeconds,
        avgPrepMinutes: avgPrepSeconds !== null ? Math.round(avgPrepSeconds / 60) : null,
      },
      activeItems: {
        queued: itemsByStatus[KitchenStatus.QUEUED] ?? 0,
        acknowledged: itemsByStatus[KitchenStatus.ACKNOWLEDGED] ?? 0,
        preparing: itemsByStatus[KitchenStatus.PREPARING] ?? 0,
        ready: itemsByStatus[KitchenStatus.READY] ?? 0,
      },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async requireOrder(tenantId: string, restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, restaurantId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async autoBumpOrderReady(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order || order.status === OrderStatus.READY || order.status === OrderStatus.COMPLETED) {
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.READY,
        readyAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.READY,
            note: 'All items ready — kitchen bump',
            changedBy: userId,
          },
        },
      },
    });

    // Notify waiters + cashiers that order is ready
    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.ORDER_READY,
        title: `Order #${order.orderNumber} is ready`,
        body: 'All items prepared — ready for pickup',
        data: { orderId, orderNumber: order.orderNumber },
        targetRoles: [UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((err) => this.logger.error(`Notification error: ${err.message}`));

    // Emit order status change so front-end updates
    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId,
      orderNumber: order.orderNumber,
      restaurantId,
      previousStatus: order.status,
      newStatus: OrderStatus.READY,
      changedAt: new Date().toISOString(),
    });
  }
}
