import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, OrderType, KitchenStatus, UserRole, NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { PushService } from '../push/push.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { UpdateKitchenStatusDto } from './dto/update-kitchen-status.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { ApplyDiscountDto, DiscountType } from './dto/apply-discount.dto';
import { AssignTableDto } from './dto/assign-table.dto';
import { RejectOrderDto } from './dto/reject-order.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
const KITCHEN_ROLES: UserRole[] = [
  UserRole.KITCHEN,
  UserRole.MANAGER,
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
];

// Valid status transitions (state machine)
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]:   [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]:  [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]:     [OrderStatus.SERVED, OrderStatus.COMPLETED],
  [OrderStatus.SERVED]:    [OrderStatus.COMPLETED],
};

// Map OrderType channel → autoAccept config key
const CHANNEL_TO_AUTO_ACCEPT: Partial<Record<OrderType, string>> = {
  [OrderType.DINE_IN]:    'pos',
  [OrderType.TAKEAWAY]:   'pos',
  [OrderType.DELIVERY]:   'pos',
  [OrderType.KIOSK]:      'pos',
  [OrderType.QR]:         'qr',
  [OrderType.ONLINE]:     'online',
  [OrderType.AGGREGATOR]: 'aggregator',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private inventory: InventoryService,
    private push: PushService,
  ) {}

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async requireRestaurant(tenantId: string, restaurantId: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  private async requireOrder(tenantId: string, restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, restaurantId },
      include: {
        items: {
          include: { modifiers: true },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        table: { select: { id: true, tableNumber: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async generateOrderNumber(restaurantId: string): Promise<string> {
    const key = `order:seq:${restaurantId}`;
    const num = await this.redis.incr(key);
    return `ORD-${String(num).padStart(5, '0')}`;
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus) {
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  // ─── M4.1 Create order ───────────────────────────────────────────────────

  async createOrder(
    tenantId: string,
    restaurantId: string,
    userId: string | null,
    dto: CreateOrderDto,
  ) {
    const restaurant = await this.requireRestaurant(tenantId, restaurantId);
    const channel = dto.channel ?? OrderType.DINE_IN;

    // Validate channel is enabled
    if (restaurant.orderTypes.length > 0 && !restaurant.orderTypes.includes(channel)) {
      throw new BadRequestException(`Order channel ${channel} is not enabled for this restaurant`);
    }

    // Validate table
    if (dto.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: { id: dto.tableId, restaurantId, tenantId },
      });
      if (!table) throw new NotFoundException('Table not found in this restaurant');
    }

    // Validate customer
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, restaurantId, tenantId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    // Fetch + validate menu items
    const itemIds = dto.items.map((i) => i.itemId);
    const menuItems = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, tenantId, restaurantId, isAvailable: true },
    });
    if (menuItems.length !== itemIds.length) {
      throw new NotFoundException('One or more items not found or not available in this restaurant');
    }
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // Fetch + validate modifiers
    const allModifierIds = dto.items.flatMap((i) => (i.modifiers ?? []).map((m) => m.modifierId));
    const menuModifiers =
      allModifierIds.length > 0
        ? await this.prisma.modifier.findMany({
            where: { id: { in: allModifierIds }, tenantId, isAvailable: true },
          })
        : [];
    const menuModifierMap = new Map(menuModifiers.map((m) => [m.id, m]));

    // Build order items with price snapshots
    let subtotal = 0;
    const orderItemsData = dto.items.map((oi) => {
      const menuItem = menuItemMap.get(oi.itemId)!;
      const modifiers = (oi.modifiers ?? []).map((om) => {
        const mod = menuModifierMap.get(om.modifierId);
        if (!mod) throw new NotFoundException(`Modifier ${om.modifierId} not found or not available`);
        return mod;
      });
      const modAdj = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
      const unitPrice = Number(menuItem.price) + modAdj;
      const totalPrice = unitPrice * oi.quantity;
      subtotal += totalPrice;
      return {
        tenantId,
        itemId: oi.itemId,
        name: menuItem.name,
        quantity: oi.quantity,
        unitPrice,
        totalPrice,
        notes: oi.notes,
        modifiers: modifiers.map((mod) => ({
          modifierId: mod.id,
          name: mod.name,
          priceAdjust: Number(mod.priceAdjustment),
        })),
      };
    });

    // Calculate totals
    const taxRate = Number(restaurant.taxRate) / 100;
    const svcRate = Number(restaurant.serviceCharge) / 100;
    const taxAmount = restaurant.taxInclusive ? 0 : subtotal * taxRate;
    const serviceChargeAmount = subtotal * svcRate;
    const tipAmount = dto.tipAmount ?? 0;
    const discountAmount = dto.discountAmount ?? 0;
    const totalAmount = subtotal + taxAmount + serviceChargeAmount + tipAmount - discountAmount;

    // Auto-accept check
    const autoAccept = (restaurant.autoAccept ?? {}) as Record<string, boolean>;
    const autoKey = CHANNEL_TO_AUTO_ACCEPT[channel];
    const shouldAutoAccept = autoKey ? autoAccept[autoKey] === true : false;
    const initialStatus = shouldAutoAccept ? OrderStatus.ACCEPTED : OrderStatus.PENDING;

    const orderNumber = await this.generateOrderNumber(restaurantId);

    const order = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          tenantId,
          restaurantId,
          orderNumber,
          channel,
          status: initialStatus,
          tableId: dto.tableId,
          tableSessionId: dto.tableSessionId,
          customerId: dto.customerId,
          createdById: userId,
          notes: dto.notes,
          subtotal,
          taxAmount,
          serviceCharge: serviceChargeAmount,
          tipAmount,
          discountAmount,
          totalAmount,
          currency: restaurant.currency,
          acceptedAt: shouldAutoAccept ? new Date() : undefined,
          items: {
            create: orderItemsData.map((oi) => ({
              tenantId: oi.tenantId,
              itemId: oi.itemId,
              name: oi.name,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              totalPrice: oi.totalPrice,
              notes: oi.notes,
              modifiers: { create: oi.modifiers },
            })),
          },
          statusHistory: {
            create: {
              status: initialStatus,
              note: shouldAutoAccept ? 'Auto-accepted' : 'Order placed',
              changedBy: userId,
            },
          },
        },
        include: {
          items: {
            include: { modifiers: true },
            orderBy: { createdAt: 'asc' },
          },
          statusHistory: { orderBy: { changedAt: 'asc' } },
          table: { select: { id: true, tableNumber: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    this.realtime.emitNewOrder(tenantId, restaurantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId,
      channel,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    });

    // Notify kitchen + managers of new order (non-blocking)
    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.NEW_ORDER,
        title: `New order #${orderNumber}`,
        body: `${channel} — ${order.items.length} item(s) — ${order.currency} ${Number(order.totalAmount).toFixed(2)}`,
        data: { orderId: order.id, orderNumber, channel, totalAmount: Number(order.totalAmount) },
        targetRoles: [UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER],
      })
      .catch((err) => this.logger.error(`Notification error: ${err.message}`));

    this.logger.log(
      `Order ${orderNumber} created (${channel}, ${initialStatus}) — restaurant ${restaurantId}`,
    );
    return order;
  }

  // ─── M4.2 List orders ────────────────────────────────────────────────────

  async listOrders(tenantId: string, restaurantId: string, query: ListOrdersQueryDto) {
    await this.requireRestaurant(tenantId, restaurantId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      restaurantId,
      ...(query.status && { status: query.status }),
      ...(query.channel && { channel: query.channel }),
      ...(query.customerId && { customerId: query.customerId }),
      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
        },
      }),
    };

    // M16.6 — Source filter: pos=no cartToken, qr=QR channel, online=cartToken+non-QR
    if (query.source === 'qr') {
      where.channel = OrderType.QR;
    } else if (query.source === 'online') {
      where.cartToken = { not: null };
      where.channel = { not: OrderType.QR };
    } else if (query.source === 'pos') {
      where.cartToken = null;
      where.channel = { notIn: [OrderType.QR] };
    }

    // M16.6 — Text search: order number or customer name/phone
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { customer: { firstName: { contains: s, mode: 'insensitive' } } },
        { customer: { lastName: { contains: s, mode: 'insensitive' } } },
        { customer: { phone: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { modifiers: true } },
          table: { select: { id: true, tableNumber: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── M4.3 Get order detail ───────────────────────────────────────────────

  async getOrder(tenantId: string, restaurantId: string, orderId: string) {
    return this.requireOrder(tenantId, restaurantId, orderId);
  }

  // ─── M4.4 Update order status ────────────────────────────────────────────

  async updateOrderStatus(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    role: UserRole,
    dto: UpdateOrderStatusDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    const order = await this.requireOrder(tenantId, restaurantId, orderId);
    this.validateStatusTransition(order.status, dto.status);

    const now = new Date();
    const timestamps: Record<string, Date> = {};
    if (dto.status === OrderStatus.ACCEPTED) timestamps.acceptedAt = now;
    if (dto.status === OrderStatus.READY) timestamps.readyAt = now;
    if (dto.status === OrderStatus.COMPLETED) timestamps.completedAt = now;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        ...timestamps,
        statusHistory: {
          create: { status: dto.status, note: dto.note, changedBy: userId },
        },
      },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        table: { select: { id: true, tableNumber: true } },
      },
    });

    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      restaurantId,
      previousStatus: order.status,
      newStatus: dto.status,
      changedAt: now.toISOString(),
      note: dto.note,
    });

    // Notify relevant staff when order becomes READY (non-blocking)
    if (dto.status === OrderStatus.READY) {
      this.notifications
        .notify({
          tenantId,
          restaurantId,
          type: NotificationType.ORDER_READY,
          title: `Order #${updated.orderNumber} is ready`,
          body: `Table service can now pick up this order`,
          data: { orderId: updated.id, orderNumber: updated.orderNumber },
          targetRoles: [UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER],
        })
        .catch((err) => this.logger.error(`Notification error: ${err.message}`));
    } else {
      this.notifications
        .notify({
          tenantId,
          restaurantId,
          type: NotificationType.ORDER_STATUS_CHANGE,
          title: `Order #${updated.orderNumber} → ${dto.status}`,
          body: dto.note ?? `Status changed from ${order.status} to ${dto.status}`,
          data: {
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            previousStatus: order.status,
            newStatus: dto.status,
          },
          targetRoles: [UserRole.MANAGER, UserRole.OWNER],
        })
        .catch((err) => this.logger.error(`Notification error: ${err.message}`));
    }

    // M20.3 — Non-blocking stock deduction on order COMPLETED
    if (dto.status === OrderStatus.COMPLETED) {
      this.inventory
        .deductForOrder(tenantId, restaurantId, orderId)
        .catch((err) => this.logger.warn(`Inventory deduction failed for ${orderId}: ${err.message}`));
    }

    // M16.4 — Notify customer via CustomerNotification if order has a customerId
    if (updated.customerId) {
      const statusMessages: Partial<Record<OrderStatus, { title: string; body: string }>> = {
        [OrderStatus.ACCEPTED]:  { title: 'Order confirmed!', body: `Your order #${updated.orderNumber} has been accepted and will be prepared shortly.` },
        [OrderStatus.PREPARING]: { title: 'Order being prepared', body: `Your order #${updated.orderNumber} is now being prepared.` },
        [OrderStatus.READY]:     { title: 'Order ready!', body: `Your order #${updated.orderNumber} is ready for pickup/service.` },
        [OrderStatus.COMPLETED]: { title: 'Order completed', body: `Your order #${updated.orderNumber} is complete. Thank you!` },
        [OrderStatus.CANCELLED]: { title: 'Order cancelled', body: `Your order #${updated.orderNumber} has been cancelled. ${dto.note ?? ''}`.trim() },
      };
      const msg = statusMessages[dto.status];
      if (msg) {
        this.prisma.customerNotification.create({
          data: {
            tenantId,
            customerId: updated.customerId,
            restaurantId,
            type: `ORDER_${dto.status}`,
            title: msg.title,
            body: msg.body,
            data: { orderId: updated.id, orderNumber: updated.orderNumber, status: dto.status },
          },
        }).catch(() => {});
        // M25.3 — Send push to customer device
        this.push.sendPushToCustomer(
          updated.customerId,
          msg.title,
          msg.body,
          { orderId: updated.id, orderNumber: updated.orderNumber, status: dto.status },
        ).catch(() => {});
      }
    }

    return updated;
  }

  // ─── M4.5 Cancel order ───────────────────────────────────────────────────

  async cancelOrder(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    role: UserRole,
    dto: CancelOrderDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const nonCancellable: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
    if (nonCancellable.includes(order.status)) {
      throw new BadRequestException(`Cannot cancel an order with status: ${order.status}`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        statusHistory: {
          create: {
            status: OrderStatus.CANCELLED,
            note: dto.reason ?? 'Cancelled',
            changedBy: userId,
          },
        },
      },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      restaurantId,
      previousStatus: order.status,
      newStatus: OrderStatus.CANCELLED,
      changedAt: new Date().toISOString(),
      note: dto.reason,
    });

    return updated;
  }

  // ─── M4.6 Update kitchen item status (KDS) ───────────────────────────────

  async updateKitchenStatus(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    itemId: string,
    userId: string,
    role: UserRole,
    dto: UpdateKitchenStatusDto,
  ) {
    if (!KITCHEN_ROLES.includes(role)) {
      throw new ForbiddenException('KITCHEN or higher role required');
    }

    await this.requireOrder(tenantId, restaurantId, orderId);

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId },
    });
    if (!orderItem) throw new NotFoundException('Order item not found');

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { kitchenStatus: dto.kitchenStatus },
    });

    this.realtime.emitKitchenUpdate(restaurantId, {
      orderId,
      orderItemId: itemId,
      restaurantId,
      status: dto.kitchenStatus,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M4.7 Void order item ────────────────────────────────────────────────

  async voidOrderItem(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    itemId: string,
    role: UserRole,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const nonVoidable: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
    if (nonVoidable.includes(order.status)) {
      throw new BadRequestException(`Cannot void items on an order with status: ${order.status}`);
    }

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId },
    });
    if (!orderItem) throw new NotFoundException('Order item not found');
    if (orderItem.isVoid) throw new BadRequestException('Order item is already voided');

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { isVoid: true, kitchenStatus: KitchenStatus.CANCELLED },
    });

    // Recalculate order totals excluding voided items
    const remaining = await this.prisma.orderItem.findMany({
      where: { orderId, isVoid: false },
    });
    const restaurant = await this.requireRestaurant(tenantId, restaurantId);
    const newSubtotal = remaining.reduce((sum, i) => sum + Number(i.totalPrice), 0);
    const taxRate = Number(restaurant.taxRate) / 100;
    const svcRate = Number(restaurant.serviceCharge) / 100;
    const newTax = restaurant.taxInclusive ? 0 : newSubtotal * taxRate;
    const newSvc = newSubtotal * svcRate;
    const newTotal = newSubtotal + newTax + newSvc + Number(order.tipAmount) - Number(order.discountAmount);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal: newSubtotal, taxAmount: newTax, serviceCharge: newSvc, totalAmount: newTotal },
    });

    return updated;
  }

  // ─── M4.8 Add items to existing order ────────────────────────────────────

  async addOrderItems(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    role: UserRole,
    dto: AddOrderItemsDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const addableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
    ];
    if (!addableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot add items to an order with status: ${order.status}. Allowed: ${addableStatuses.join(', ')}`,
      );
    }

    // Validate items
    const itemIds = dto.items.map((i) => i.itemId);
    const menuItems = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, tenantId, restaurantId, isAvailable: true },
    });
    if (menuItems.length !== itemIds.length) {
      throw new NotFoundException('One or more items not found or not available');
    }
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const allModifierIds = dto.items.flatMap((i) => (i.modifiers ?? []).map((m) => m.modifierId));
    const menuModifiers =
      allModifierIds.length > 0
        ? await this.prisma.modifier.findMany({
            where: { id: { in: allModifierIds }, tenantId, isAvailable: true },
          })
        : [];
    const menuModifierMap = new Map(menuModifiers.map((m) => [m.id, m]));

    let addedSubtotal = 0;
    const newItemsData = dto.items.map((oi) => {
      const menuItem = menuItemMap.get(oi.itemId)!;
      const modifiers = (oi.modifiers ?? []).map((om) => {
        const mod = menuModifierMap.get(om.modifierId);
        if (!mod) throw new NotFoundException(`Modifier ${om.modifierId} not found`);
        return mod;
      });
      const modAdj = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
      const unitPrice = Number(menuItem.price) + modAdj;
      const totalPrice = unitPrice * oi.quantity;
      addedSubtotal += totalPrice;
      return {
        tenantId,
        orderId,
        itemId: oi.itemId,
        name: menuItem.name,
        quantity: oi.quantity,
        unitPrice,
        totalPrice,
        notes: oi.notes,
        modifiers: modifiers.map((mod) => ({
          modifierId: mod.id,
          name: mod.name,
          priceAdjust: Number(mod.priceAdjustment),
        })),
      };
    });

    const restaurant = await this.requireRestaurant(tenantId, restaurantId);

    await this.prisma.$transaction(async (tx) => {
      for (const oi of newItemsData) {
        await tx.orderItem.create({
          data: {
            tenantId: oi.tenantId,
            orderId: oi.orderId,
            itemId: oi.itemId,
            name: oi.name,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            totalPrice: oi.totalPrice,
            notes: oi.notes,
            modifiers: { create: oi.modifiers },
          },
        });
      }

      const newSubtotal = Number(order.subtotal) + addedSubtotal;
      const taxRate = Number(restaurant.taxRate) / 100;
      const svcRate = Number(restaurant.serviceCharge) / 100;
      const newTax = restaurant.taxInclusive ? 0 : newSubtotal * taxRate;
      const newSvc = newSubtotal * svcRate;
      const newTotal =
        newSubtotal + newTax + newSvc + Number(order.tipAmount) - Number(order.discountAmount);

      await tx.order.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, taxAmount: newTax, serviceCharge: newSvc, totalAmount: newTotal },
      });
    });

    return this.requireOrder(tenantId, restaurantId, orderId);
  }

  // ─── M5.8 Apply/update discount on order ─────────────────────────────────

  async applyDiscount(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    role: UserRole,
    dto: ApplyDiscountDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    const order = await this.requireOrder(tenantId, restaurantId, orderId);

    const closedStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
    if (closedStatuses.includes(order.status)) {
      throw new BadRequestException(`Cannot apply discount to an order with status: ${order.status}`);
    }

    const subtotal = Number(order.subtotal);
    let discountAmount: number;

    if (dto.type === DiscountType.PERCENT) {
      if (dto.value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%');
      discountAmount = subtotal * (dto.value / 100);
    } else {
      if (dto.value > subtotal) throw new BadRequestException('Flat discount cannot exceed order subtotal');
      discountAmount = dto.value;
    }

    const restaurant = await this.requireRestaurant(tenantId, restaurantId);
    const taxRate = Number(restaurant.taxRate) / 100;
    const svcRate = Number(restaurant.serviceCharge) / 100;
    const taxAmount = restaurant.taxInclusive ? 0 : subtotal * taxRate;
    const svcAmount = subtotal * svcRate;
    const totalAmount = subtotal + taxAmount + svcAmount + Number(order.tipAmount) - discountAmount;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { discountAmount, totalAmount },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    return updated;
  }

  // ─── M5.9 Assign/reassign order to table + session ───────────────────────

  async assignTable(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    role: UserRole,
    dto: AssignTableDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }

    await this.requireOrder(tenantId, restaurantId, orderId);

    // Validate table if provided
    if (dto.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: { id: dto.tableId, restaurantId, tenantId },
      });
      if (!table) throw new NotFoundException('Table not found in this restaurant');
    }

    // Validate session if provided
    if (dto.tableSessionId) {
      const session = await this.prisma.tableSession.findFirst({
        where: { id: dto.tableSessionId, tenantId },
      });
      if (!session) throw new NotFoundException('Table session not found');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        tableId: dto.tableId ?? null,
        tableSessionId: dto.tableSessionId ?? null,
      },
      include: {
        items: { include: { modifiers: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    });

    return updated;
  }

  // ─── M16.2 Accept order ───────────────────────────────────────────────────
  async acceptOrder(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    role: UserRole,
  ) {
    return this.updateOrderStatus(tenantId, restaurantId, orderId, userId, role, {
      status: OrderStatus.ACCEPTED,
      note: 'Order accepted by staff',
    });
  }

  // ─── M16.2 Reject order ───────────────────────────────────────────────────
  async rejectOrder(
    tenantId: string,
    restaurantId: string,
    orderId: string,
    userId: string,
    role: UserRole,
    dto: RejectOrderDto,
  ) {
    const order = await this.requireOrder(tenantId, restaurantId, orderId);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Only PENDING orders can be rejected. Current status: ${order.status}`);
    }

    const reason = dto.reason ?? 'Order rejected by staff';
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        statusHistory: { create: { status: OrderStatus.CANCELLED, note: reason, changedBy: userId } },
      },
      include: {
        items: { include: { modifiers: true } },
        table: { select: { id: true, tableNumber: true } },
        customer: { select: { id: true, firstName: true } },
      },
    });

    this.realtime.emitOrderStatusChange(tenantId, restaurantId, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      restaurantId,
      previousStatus: OrderStatus.PENDING,
      newStatus: OrderStatus.CANCELLED,
      changedAt: new Date().toISOString(),
      note: reason,
    });

    // Customer notification
    if (updated.customerId) {
      const rejectBody = `Your order #${updated.orderNumber} was rejected. Reason: ${reason}`;
      this.prisma.customerNotification.create({
        data: {
          tenantId, customerId: updated.customerId, restaurantId,
          type: 'ORDER_REJECTED',
          title: 'Order rejected',
          body: rejectBody,
          data: { orderId: updated.id, orderNumber: updated.orderNumber, reason },
        },
      }).catch(() => {});
      this.push.sendPushToCustomer(
        updated.customerId,
        'Order rejected',
        rejectBody,
        { orderId: updated.id, orderNumber: updated.orderNumber, reason },
      ).catch(() => {});
    }

    return updated;
  }

  // ─── M16.7 Print ticket ───────────────────────────────────────────────────
  async getPrintTicket(tenantId: string, restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, restaurantId },
      include: {
        items: {
          include: {
            item: { select: { name: true } },
            modifiers: { include: { modifier: { select: { name: true } } } },
          },
        },
        table: { select: { tableNumber: true, floorSection: { select: { name: true } } } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
        payments: { where: { status: 'COMPLETED' }, select: { method: true, amount: true, gatewayName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, address: true, phone: true, currency: true, receiptConfig: true },
    });

    return {
      ticket: {
        restaurantName: restaurant?.name ?? '',
        restaurantAddress: restaurant?.address ?? '',
        restaurantPhone: restaurant?.phone ?? '',
        currency: restaurant?.currency ?? 'BDT',
        orderNumber: order.orderNumber,
        orderType: order.channel,
        status: order.status,
        table: order.table ? `${(order.table as any).floorSection?.name ?? ''} T${(order.table as any).tableNumber}` : null,
        customer: order.customer
          ? { name: `${(order.customer as any).firstName} ${(order.customer as any).lastName ?? ''}`.trim(), phone: (order.customer as any).phone }
          : null,
        createdAt: order.createdAt,
        items: (order.items as any[]).map((oi) => ({
          name: oi.item?.name ?? oi.name,
          quantity: oi.quantity,
          unitPrice: Number(oi.unitPrice),
          totalPrice: Number(oi.totalPrice),
          modifiers: (oi.modifiers ?? []).map((m: any) => m.modifier?.name ?? m.modifierId),
          notes: oi.notes,
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        serviceCharge: Number(order.serviceCharge ?? 0),
        tipAmount: Number(order.tipAmount ?? 0),
        discountAmount: Number(order.discountAmount ?? 0),
        totalAmount: Number(order.totalAmount),
        aggregatorName: order.aggregatorName ?? null,
        externalOrderId: order.externalOrderId ?? null,
        guestName: order.guestName ?? null,
        payments: (order.payments as any[]).map((p) => ({
          method: p.gatewayName ?? p.method,
          amount: Number(p.amount),
        })),
        receiptConfig: restaurant?.receiptConfig,
        printedAt: new Date().toISOString(),
      },
    };
  }

  // ─── M16.3 Auto-accept orders (called by cron) ───────────────────────────
  async autoAcceptPendingOrders(): Promise<void> {
    // Find all restaurants with autoAcceptMinutes configured
    const restaurants = await this.prisma.restaurant.findMany({
      where: { isActive: true, autoAcceptMinutes: { not: null } },
      select: { id: true, tenantId: true, autoAcceptMinutes: true, autoAccept: true },
    });

    for (const restaurant of restaurants) {
      const config = restaurant.autoAcceptMinutes as Record<string, number> | null;
      if (!config) continue;

      const autoAccept = restaurant.autoAccept as Record<string, boolean> | null ?? {};

      for (const [source, minutes] of Object.entries(config)) {
        if (!minutes || minutes <= 0) continue;
        // Only auto-accept if the source is enabled in autoAccept config
        if (autoAccept[source] === false) continue;

        // Determine which channels map to this source
        const channelMap: Record<string, OrderType[]> = {
          pos: [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY, OrderType.KIOSK],
          qr: [OrderType.QR],
          online: [OrderType.ONLINE],
          aggregator: [OrderType.AGGREGATOR],
        };
        const channels = channelMap[source];
        if (!channels) continue;

        const cutoff = new Date(Date.now() - minutes * 60 * 1000);

        const pendingOrders = await this.prisma.order.findMany({
          where: {
            restaurantId: restaurant.id,
            status: OrderStatus.PENDING,
            channel: { in: channels },
            createdAt: { lte: cutoff },
          },
          select: { id: true, orderNumber: true, customerId: true, channel: true, totalAmount: true },
        });

        for (const order of pendingOrders) {
          try {
            await this.prisma.$transaction([
              this.prisma.order.update({
                where: { id: order.id },
                data: {
                  status: OrderStatus.ACCEPTED,
                  acceptedAt: new Date(),
                  statusHistory: {
                    create: {
                      status: OrderStatus.ACCEPTED,
                      note: `Auto-accepted after ${minutes} minutes (${source} channel)`,
                    },
                  },
                },
              }),
            ]);

            this.realtime.emitOrderStatusChange(restaurant.tenantId, restaurant.id, {
              orderId: order.id,
              orderNumber: order.orderNumber,
              restaurantId: restaurant.id,
              previousStatus: OrderStatus.PENDING,
              newStatus: OrderStatus.ACCEPTED,
              changedAt: new Date().toISOString(),
              note: `Auto-accepted`,
            });

            // Customer notification
            if (order.customerId) {
              this.prisma.customerNotification.create({
                data: {
                  tenantId: restaurant.tenantId,
                  customerId: order.customerId,
                  restaurantId: restaurant.id,
                  type: 'ORDER_ACCEPTED',
                  title: 'Order confirmed!',
                  body: `Your order #${order.orderNumber} has been automatically accepted.`,
                  data: { orderId: order.id, orderNumber: order.orderNumber },
                },
              }).catch(() => {});
            }

            this.logger.log(`Auto-accepted order ${order.orderNumber} (${source})`);
          } catch (err) {
            this.logger.error(`Auto-accept failed for order ${order.id}: ${err.message}`);
          }
        }
      }
    }
  }
}
