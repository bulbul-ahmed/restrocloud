import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OrderType,
  SessionStatus,
  TableStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { MenuService } from '../menu/menu.service';
import { CartAddItemDto } from './dto/cart-add-item.dto';
import { CartUpdateItemDto } from './dto/cart-update-item.dto';
import { PlaceQrOrderDto } from './dto/place-qr-order.dto';
import { IdentifyGuestDto } from './dto/identify-guest.dto';
import { RequestBillDto } from './dto/request-bill.dto';
import { CallWaiterDto } from './dto/call-waiter.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

// ─── Cart types ──────────────────────────────────────────────────────────────

export interface CartModifier {
  modifierId: string;
  name: string;
  priceAdjust: number;
}

export interface CartItem {
  cartItemId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: CartModifier[];
  notes?: string;
  totalPrice: number;
}

export interface Cart {
  restaurantId: string;
  tableId: string;
  guestToken: string;
  customerId?: string;
  guestName?: string;
  guestPhone?: string;
  deviceId?: string;
  items: CartItem[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

const CART_KEY = (restaurantId: string, guestToken: string) =>
  `qr:cart:${restaurantId}:${guestToken}`;
const ORDER_KEY = (restaurantId: string, guestToken: string) =>
  `qr:order:${restaurantId}:${guestToken}`;
const RESOLVE_KEY = (restaurantId: string, tableId: string) =>
  `qr:resolve:${restaurantId}:${tableId}`;
const TABLE_TOKENS_KEY = (restaurantId: string, tableId: string) =>
  `qr:table-tokens:${restaurantId}:${tableId}`;

const CART_TTL = 3600;   // 1 hour, sliding
const ORDER_TTL = 86400; // 24 hours
const RESOLVE_TTL = 30;  // 30 seconds
const TABLE_TOKENS_TTL = 7200; // 2 hours

@Injectable()
export class QrOrderingService {
  private readonly logger = new Logger(QrOrderingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private ordersService: OrdersService,
    private menuService: MenuService,
  ) {}

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Resolve restaurantId → restaurant row. Validates isActive + QR ordering enabled. */
  private async resolveRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isActive: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (
      restaurant.orderTypes.length > 0 &&
      !restaurant.orderTypes.includes(OrderType.QR)
    ) {
      throw new ForbiddenException('QR ordering is not enabled for this restaurant');
    }
    return restaurant;
  }

  /** Load cart from Redis; throws 404 if missing or expired. */
  private async requireCart(restaurantId: string, guestToken: string): Promise<Cart> {
    const cart = await this.redis.getJson<Cart>(CART_KEY(restaurantId, guestToken));
    if (!cart) throw new NotFoundException('Cart not found or expired — please re-scan the QR code');
    return cart;
  }

  /** Write cart back to Redis with sliding TTL. */
  private async saveCart(cart: Cart): Promise<void> {
    cart.updatedAt = new Date().toISOString();
    await this.redis.setJson(CART_KEY(cart.restaurantId, cart.guestToken), cart, CART_TTL);
  }

  /** Recompute subtotal from items array. */
  private computeSubtotal(items: CartItem[]): number {
    return items.reduce((sum, i) => sum + i.totalPrice, 0);
  }

  /**
   * Find an existing active session for this table or create a new one.
   * Returns the tableSessionId.
   */
  private async findOrCreateSession(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    guestCount: number,
  ): Promise<string> {
    const existing = await this.prisma.tableSession.findFirst({
      where: {
        tableId,
        tenantId,
        status: SessionStatus.OPEN,
      },
    });
    if (existing) return existing.id;

    // Create new session and mark table OCCUPIED
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.OCCUPIED },
      });
      return tx.tableSession.create({
        data: {
          tenantId,
          tableId,
          guestCount,
          status: SessionStatus.OPEN,
        },
      });
    });

    this.realtime.emitToTenant(tenantId, 'table_status_changed', {
      tableId,
      restaurantId,
      status: TableStatus.OCCUPIED,
      sessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    return session.id;
  }

  // ─── M12.1 Resolve QR table ───────────────────────────────────────────────

  async resolveTable(restaurantId: string, tableId: string) {
    const cached = await this.redis.getJson<any>(RESOLVE_KEY(restaurantId, tableId));
    if (cached) return cached;

    const restaurant = await this.resolveRestaurant(restaurantId);

    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      include: { floorSection: { select: { id: true, name: true } } },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (!table.isActive) throw new BadRequestException('This table is not currently active');

    let activeSession = await this.prisma.tableSession.findFirst({
      where: {
        tableId,
        tenantId: restaurant.tenantId,
        status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] },
      },
      select: { id: true, guestCount: true, status: true, openedAt: true },
    });

    const result = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logoUrl: restaurant.logoUrl,
        brandColor: restaurant.brandColor,
        currency: restaurant.currency,
        timezone: restaurant.timezone,
        taxRate: Number(restaurant.taxRate),
        taxInclusive: restaurant.taxInclusive,
        serviceCharge: Number(restaurant.serviceCharge),
        tipOptions: restaurant.tipOptions,
      },
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        floorSection: table.floorSection,
      },
      activeSession,
    };

    await this.redis.setJson(RESOLVE_KEY(restaurantId, tableId), result, RESOLVE_TTL);
    return result;
  }

  // ─── Flatten join-table modifierGroups into the shape the frontend expects ─

  private flattenModifierGroups(rawMgs: any[]): any[] {
    return (rawMgs ?? []).map((mg: any) => {
      const g = mg.modifierGroup;
      return {
        id: g.id,
        name: g.name,
        isRequired: g.isRequired,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        modifiers: (g.modifiers ?? []).map((mod: any) => ({
          id: mod.id,
          name: mod.name,
          priceAdjustment: Number(mod.priceAdjustment ?? 0),
          isAvailable: mod.isAvailable,
          isRequired: mod.isRequired,
          childGroups: mod.childGroups?.length
            ? this.flattenModifierGroups(mod.childGroups)
            : undefined,
        })),
      };
    });
  }

  // ─── M12.2 Public menu ────────────────────────────────────────────────────

  async getPublicMenu(restaurantId: string) {
    const restaurant = await this.resolveRestaurant(restaurantId);
    const menu = await this.menuService.getFullMenu(restaurant.tenantId, restaurantId);

    // Strip costPrice and flatten join-table modifierGroups for public view
    return (menu as any[]).map((category: any) => ({
      ...category,
      items: (category.items ?? []).map((item: any) => {
        const { costPrice: _cost, modifierGroups: rawMgs, ...publicItem } = item;
        return {
          ...publicItem,
          modifierGroups: this.flattenModifierGroups(rawMgs ?? []),
        };
      }),
    }));
  }

  // ─── M12.3 Menu item detail ───────────────────────────────────────────────

  async getPublicItem(restaurantId: string, itemId: string) {
    const restaurant = await this.resolveRestaurant(restaurantId);

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, restaurantId, tenantId: restaurant.tenantId, isAvailable: true },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: { isAvailable: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found or not available');

    const { costPrice: _cost, modifierGroups: rawMgs, ...publicItem } = item as any;
    return {
      ...publicItem,
      modifierGroups: this.flattenModifierGroups(rawMgs ?? []),
    };
  }

  // ─── M12.4 Init guest cart ────────────────────────────────────────────────

  async initCart(restaurantId: string, tableId: string, deviceId?: string) {
    // Validate table exists and restaurant has QR enabled
    await this.resolveRestaurant(restaurantId);

    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table || !table.isActive) {
      throw new NotFoundException('Table not found or not active');
    }

    const guestToken = uuidv4();
    const cart: Cart = {
      restaurantId,
      tableId,
      guestToken,
      deviceId,
      items: [],
      subtotal: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveCart(cart);

    // Register this token in the table's active-token set so all carts are discoverable
    const setKey = TABLE_TOKENS_KEY(restaurantId, tableId);
    await this.redis.sadd(setKey, guestToken);
    await this.redis.expire(setKey, TABLE_TOKENS_TTL);

    return { guestToken, tableId, restaurantId, expiresInSeconds: CART_TTL };
  }

  // ─── M12.5a Add item to cart ──────────────────────────────────────────────

  async addToCart(restaurantId: string, dto: CartAddItemDto) {
    const cart = await this.requireCart(restaurantId, dto.guestToken);
    const restaurant = await this.resolveRestaurant(restaurantId);

    const menuItem = await this.prisma.item.findFirst({
      where: { id: dto.itemId, restaurantId, tenantId: restaurant.tenantId, isAvailable: true },
    });
    if (!menuItem) throw new NotFoundException('Item not found or not available');

    const modifierIds = (dto.modifiers ?? []).map((m) => m.modifierId);
    const dbModifiers = modifierIds.length > 0
      ? await this.prisma.modifier.findMany({
          where: { id: { in: modifierIds }, tenantId: restaurant.tenantId, isAvailable: true },
        })
      : [];
    if (dbModifiers.length !== modifierIds.length) {
      throw new NotFoundException('One or more modifiers not found or not available');
    }

    const modAdj = dbModifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
    const unitPrice = Number(menuItem.price) + modAdj;
    const totalPrice = unitPrice * dto.quantity;

    const cartItem: CartItem = {
      cartItemId: uuidv4(),
      itemId: dto.itemId,
      name: menuItem.name,
      quantity: dto.quantity,
      unitPrice,
      modifiers: dbModifiers.map((m) => ({
        modifierId: m.id,
        name: m.name,
        priceAdjust: Number(m.priceAdjustment),
      })),
      notes: dto.notes,
      totalPrice,
    };

    cart.items.push(cartItem);
    cart.subtotal = this.computeSubtotal(cart.items);
    await this.saveCart(cart);
    return this.formatCart(cart, restaurant);
  }

  // ─── M12.5b Update cart item ──────────────────────────────────────────────

  async updateCartItem(restaurantId: string, cartItemId: string, dto: CartUpdateItemDto) {
    const cart = await this.requireCart(restaurantId, dto.guestToken);
    const restaurant = await this.resolveRestaurant(restaurantId);

    const idx = cart.items.findIndex((i) => i.cartItemId === cartItemId);
    if (idx === -1) throw new NotFoundException('Cart item not found');

    const item = cart.items[idx];
    item.quantity = dto.quantity;
    item.totalPrice = item.unitPrice * dto.quantity;

    cart.subtotal = this.computeSubtotal(cart.items);
    await this.saveCart(cart);
    return this.formatCart(cart, restaurant);
  }

  // ─── M12.5c Remove cart item ──────────────────────────────────────────────

  async removeCartItem(restaurantId: string, cartItemId: string, guestToken: string) {
    const cart = await this.requireCart(restaurantId, guestToken);
    const restaurant = await this.resolveRestaurant(restaurantId);

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.cartItemId !== cartItemId);
    if (cart.items.length === before) throw new NotFoundException('Cart item not found');

    cart.subtotal = this.computeSubtotal(cart.items);
    await this.saveCart(cart);
    return this.formatCart(cart, restaurant);
  }

  // ─── M12.6 View cart ──────────────────────────────────────────────────────

  async getCart(restaurantId: string, guestToken: string) {
    const cart = await this.requireCart(restaurantId, guestToken);
    const restaurant = await this.resolveRestaurant(restaurantId);
    return this.formatCart(cart, restaurant);
  }

  /** Build the full cart response with tax/svc estimates. */
  private formatCart(cart: Cart, restaurant: any) {
    const subtotal = cart.subtotal;
    const taxRate = Number(restaurant.taxRate) / 100;
    const svcRate = Number(restaurant.serviceCharge) / 100;
    const taxEstimate = restaurant.taxInclusive ? 0 : subtotal * taxRate;
    const serviceChargeEstimate = subtotal * svcRate;
    const totalEstimate = subtotal + taxEstimate + serviceChargeEstimate;

    return {
      guestToken: cart.guestToken,
      tableId: cart.tableId,
      restaurantId: cart.restaurantId,
      items: cart.items,
      itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      taxEstimate: Math.round(taxEstimate * 100) / 100,
      serviceChargeEstimate: Math.round(serviceChargeEstimate * 100) / 100,
      totalEstimate: Math.round(totalEstimate * 100) / 100,
      currency: restaurant.currency,
      updatedAt: cart.updatedAt,
    };
  }

  // ─── M12.7 Place order ────────────────────────────────────────────────────

  async placeOrder(restaurantId: string, dto: PlaceQrOrderDto, req?: any) {
    const cart = await this.requireCart(restaurantId, dto.guestToken);
    if (cart.tableId !== dto.tableId) {
      throw new BadRequestException('Table mismatch — please re-scan the QR code');
    }
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const restaurant = await this.resolveRestaurant(restaurantId);
    const tenantId = restaurant.tenantId;

    // Validate table
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: dto.tableId, restaurantId, tenantId },
    });
    if (!table || !table.isActive) throw new NotFoundException('Table not found or not active');

    // Find or create table session
    const tableSessionId = await this.findOrCreateSession(
      tenantId,
      restaurantId,
      dto.tableId,
      dto.guestCount ?? 1,
    );

    // Collect all other carts at this table and merge into one order
    const allTokens: string[] = await this.redis.smembers(TABLE_TOKENS_KEY(restaurantId, cart.tableId));
    const allCarts: Cart[] = [cart];
    for (const token of allTokens) {
      if (token === dto.guestToken) continue;
      const other = await this.redis.getJson<Cart>(CART_KEY(restaurantId, token));
      if (other && other.items.length > 0) allCarts.push(other);
    }

    // Merge items from every cart into a single order
    const mergedItems = allCarts.flatMap((c) =>
      c.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
        notes: i.notes,
        modifiers: i.modifiers.map((m) => ({ modifierId: m.modifierId })),
      })),
    );

    // Build CreateOrderDto
    const createOrderDto = {
      channel: OrderType.QR,
      tableId: dto.tableId,
      tableSessionId,
      customerId: cart.customerId,
      notes: dto.notes,
      tipAmount: dto.tipAmount ?? 0,
      items: mergedItems,
    };

    // Create single order for the whole table
    const order = await this.ordersService.createOrder(
      tenantId,
      restaurantId,
      null,
      createOrderDto as any,
    );

    // Capture IP / User-Agent from initiating request
    const deviceIp =
      (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req?.ip ??
      null;
    const deviceUserAgent = (req?.headers?.['user-agent'] as string) ?? null;

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        guestName: cart.guestName ?? null,
        guestPhone: cart.guestPhone ?? null,
        deviceId: cart.deviceId ?? null,
        deviceIp,
        deviceUserAgent,
      },
    });

    // Map every guest token → this orderId so all guests can discover and track it
    for (const c of allCarts) {
      await this.redis.set(ORDER_KEY(restaurantId, c.guestToken), order.id, ORDER_TTL);
      await this.redis.del(CART_KEY(restaurantId, c.guestToken));
    }
    // Remove the entire table token set — all carts are now part of one order
    await this.redis.del(TABLE_TOKENS_KEY(restaurantId, cart.tableId));

    this.logger.log(
      `QR table order ${order.orderNumber} placed (${allCarts.length} guest(s)) — table ${table.tableNumber} — restaurant ${restaurantId}`,
    );

    // M12.9 — Pay Now vs Pay Later
    const paymentPreference = dto.paymentPreference ?? 'pay_later';
    const payNowUrl = paymentPreference === 'pay_now'
      ? `https://order.restrocloud.com/table/${restaurantId}/${dto.tableId}/pay/${order.id}`
      : null;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      channel: order.channel,
      tableNumber: table.tableNumber,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      paymentPreference,
      payNowUrl,
      items: (order.items as any[]).map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
      })),
    };
  }

  // ─── My order lookup (for guests whose cart was merged by another guest) ───

  async getMyOrder(restaurantId: string, guestToken: string) {
    const orderId = await this.redis.get(ORDER_KEY(restaurantId, guestToken));
    if (!orderId) throw new NotFoundException('No order found for this guest token');
    return { orderId };
  }

  // ─── M12.8 Track order status ─────────────────────────────────────────────

  async trackOrder(restaurantId: string, orderId: string, guestToken: string) {
    // Validate ownership
    const storedOrderId = await this.redis.get(ORDER_KEY(restaurantId, guestToken));
    if (storedOrderId !== orderId) {
      throw new ForbiddenException('Order access denied — invalid guest token');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          where: { isVoid: false },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        table: { select: { tableNumber: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      channel: order.channel,
      tableNumber: order.table?.tableNumber ?? null,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      estimatedReadyAt: order.estimatedReadyAt,
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      serviceChargeAmount: Number(order.serviceCharge),
      tipAmount: Number(order.tipAmount),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      items: (order.items as any[]).map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        kitchenStatus: i.kitchenStatus,
      })),
      statusHistory: (order.statusHistory as any[]).map((h: any) => ({
        status: h.status,
        note: h.note,
        changedAt: h.changedAt,
      })),
    };
  }

  // ─── M12.9 Request bill ───────────────────────────────────────────────────

  async requestBill(restaurantId: string, orderId: string, dto: RequestBillDto) {
    // Validate ownership
    const storedOrderId = await this.redis.get(ORDER_KEY(restaurantId, dto.guestToken));
    if (storedOrderId !== orderId) {
      throw new ForbiddenException('Order access denied — invalid guest token');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { restaurant: { select: { tenantId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.tableSessionId) {
      throw new BadRequestException('No table session associated with this order');
    }

    const session = await this.prisma.tableSession.findUnique({
      where: { id: order.tableSessionId },
    });
    if (!session) throw new NotFoundException('Table session not found');

    // Idempotent — already requested
    if (session.status === SessionStatus.BILL_REQUESTED) {
      return { message: 'Bill already requested. Staff has been notified.', sessionStatus: session.status };
    }

    await this.prisma.tableSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.BILL_REQUESTED },
    });

    const tenantId = order.restaurant.tenantId;

    this.realtime.emitToTenant(tenantId, 'bill_requested', {
      tableId: order.tableId,
      restaurantId,
      sessionId: session.id,
      orderId,
      requestedAt: new Date().toISOString(),
    });

    this.notifications.notify({
      tenantId,
      restaurantId,
      type: NotificationType.BILL_REQUESTED,
      title: `Bill requested at table`,
      body: `Order #${order.orderNumber} — customer requested the bill`,
      data: { orderId, orderNumber: order.orderNumber, tableId: order.tableId },
      targetRoles: [UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER],
    }).catch((err) => this.logger.error(`Bill request notification error: ${err.message}`));

    return { message: 'Bill requested. Staff has been notified.', sessionStatus: SessionStatus.BILL_REQUESTED };
  }

  // ─── M12.10 Get receipt ───────────────────────────────────────────────────

  async getReceipt(restaurantId: string, orderId: string, guestToken: string) {
    // Validate ownership
    const storedOrderId = await this.redis.get(ORDER_KEY(restaurantId, guestToken));
    if (storedOrderId !== orderId) {
      throw new ForbiddenException('Order access denied — invalid guest token');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          where: { isVoid: false },
          include: { modifiers: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: { where: { status: { not: 'CANCELLED' as any } } },
        table: { select: { tableNumber: true } },
        restaurant: {
          select: { name: true, phone: true, address: true, receiptConfig: true, currency: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const config = (order.restaurant.receiptConfig ?? {}) as any;

    return {
      receipt: {
        header: config.header ?? order.restaurant.name,
        footer: config.footer ?? 'Thank you for dining with us!',
        restaurantName: order.restaurant.name,
        restaurantPhone: order.restaurant.phone,
        restaurantAddress: order.restaurant.address,
        orderNumber: order.orderNumber,
        tableNumber: order.table?.tableNumber ?? null,
        channel: order.channel,
        createdAt: order.createdAt,
        currency: order.currency,
        items: (order.items as any[]).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          modifiers: (i.modifiers as any[]).map((m: any) => m.name),
          notes: i.notes,
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        serviceCharge: Number(order.serviceCharge),
        tipAmount: Number(order.tipAmount),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        payments: (order.payments as any[]).map((p: any) => ({
          method: p.method,
          amount: Number(p.amount),
          status: p.status,
          paidAt: p.paidAt,
        })),
      },
    };
  }

  // ─── M12.11 Identify guest ────────────────────────────────────────────────

  async identifyGuest(restaurantId: string, dto: IdentifyGuestDto) {
    const cart = await this.requireCart(restaurantId, dto.guestToken);
    const restaurant = await this.resolveRestaurant(restaurantId);
    const tenantId = restaurant.tenantId;

    let customer: any = null;
    let isNewCustomer = false;

    if (dto.phone) {
      customer = await this.prisma.customer.findFirst({
        where: { restaurantId, tenantId, phone: dto.phone },
      });
      if (customer?.isBlacklisted) {
        throw new ForbiddenException('Unable to complete order — please speak to staff');
      }
    }

    if (!customer) {
      // Create a minimal customer record
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          restaurantId,
          firstName: dto.firstName,
          phone: dto.phone,
          email: dto.email,
          loyaltyAccount: { create: { tenantId } },
        },
        include: { loyaltyAccount: true },
      });
      isNewCustomer = true;
    }

    // Store identity in cart
    cart.customerId = customer.id;
    cart.guestName = dto.firstName;
    cart.guestPhone = dto.phone;
    await this.saveCart(cart);

    return {
      customerId: customer.id,
      firstName: customer.firstName,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyAccount?.points ?? 0,
      tier: customer.loyaltyAccount?.tier ?? 'BRONZE',
      isNewCustomer,
    };
  }

  // ─── M12.7 Upsell / cross-sell suggestions ───────────────────────────────

  async getUpsells(restaurantId: string, itemId: string) {
    const restaurant = await this.resolveRestaurant(restaurantId);

    // Find orders containing this item in the last 90 days (QR channel)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const coOrders = await this.prisma.orderItem.findMany({
      where: {
        tenantId: restaurant.tenantId,
        itemId,
        isVoid: false,
        order: { restaurantId, createdAt: { gte: since }, channel: OrderType.QR },
      },
      select: { orderId: true },
      take: 200,
    });

    if (coOrders.length === 0) {
      // Fallback: return popular available items from this restaurant
      const fallback = await this.prisma.item.findMany({
        where: { restaurantId, tenantId: restaurant.tenantId, isAvailable: true, id: { not: itemId } },
        orderBy: { sortOrder: 'asc' },
        take: 4,
        select: { id: true, name: true, price: true, imageUrl: true, description: true },
      });
      return { suggestions: fallback, basedOn: 'popular' };
    }

    const orderIds = coOrders.map((o) => o.orderId);

    // Fetch co-occurring items and count manually to avoid groupBy type issues
    const paired = await this.prisma.orderItem.findMany({
      where: {
        tenantId: restaurant.tenantId,
        orderId: { in: orderIds },
        itemId: { not: itemId, notIn: [] },
        isVoid: false,
      },
      select: { itemId: true },
    });

    // Count occurrences in memory
    const counts = new Map<string, number>();
    for (const row of paired) {
      if (!row.itemId) continue;
      counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);
    }

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id);

    if (topIds.length === 0) {
      return { suggestions: [], basedOn: 'co-orders' };
    }

    const items = await this.prisma.item.findMany({
      where: { id: { in: topIds }, isAvailable: true },
      select: { id: true, name: true, price: true, imageUrl: true, description: true },
    });

    const sorted = topIds.map((id) => items.find((i) => i.id === id)).filter(Boolean);
    return { suggestions: sorted, basedOn: 'co-orders' };
  }

  // ─── M12.12a Staff online check ───────────────────────────────────────────

  async isStaffOnline(restaurantId: string): Promise<{ available: boolean }> {
    const restaurant = await this.resolveRestaurant(restaurantId);
    const available = this.realtime.isStaffAvailable(
      restaurant.tenantId,
      [UserRole.WAITER, UserRole.MANAGER],
    );
    return { available };
  }

  // ─── M12.12 Call waiter ───────────────────────────────────────────────────

  async callWaiter(restaurantId: string, dto: CallWaiterDto) {
    const restaurant = await this.resolveRestaurant(restaurantId);
    const tenantId = restaurant.tenantId;

    // Resolve tableId from cart (pre-order) or from placed order (post-order).
    // The cart is deleted from Redis after placeOrder(), so we must fall back to
    // the ORDER_KEY → orderId → DB lookup when the customer calls from tracking view.
    let tableId: string | null = null;
    const cart = await this.redis.getJson<Cart>(CART_KEY(restaurantId, dto.guestToken));
    if (cart) {
      tableId = cart.tableId;
    } else {
      const orderId = await this.redis.get(ORDER_KEY(restaurantId, dto.guestToken));
      if (!orderId) throw new NotFoundException('Session not found — please re-scan the QR code');
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, restaurantId },
        select: { tableId: true },
      });
      tableId = order?.tableId ?? null;
    }

    if (!tableId) throw new NotFoundException('Table could not be resolved');

    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { tableNumber: true },
    });

    this.realtime.emitToTenant(tenantId, 'waiter_called', {
      tableId,
      tableNumber: table?.tableNumber ?? null,
      restaurantId,
      message: dto.message ?? null,
      calledAt: new Date().toISOString(),
    });

    this.notifications.notify({
      tenantId,
      restaurantId,
      type: NotificationType.WAITER_CALLED,
      title: `Waiter called — table ${table?.tableNumber ?? '?'}`,
      body: dto.message ?? 'A customer at the table is calling for assistance',
      data: { tableId, restaurantId },
      targetRoles: [UserRole.WAITER, UserRole.MANAGER],
    }).catch((err) => this.logger.error(`Call waiter notification error: ${err.message}`));

    return { message: 'Staff has been notified. Someone will be with you shortly.' };
  }

  // ─── M12.14 Post-meal feedback ────────────────────────────────────────────

  async submitFeedback(restaurantId: string, orderId: string, dto: SubmitFeedbackDto) {
    // Validate ownership
    const storedOrderId = await this.redis.get(ORDER_KEY(restaurantId, dto.guestToken));
    if (storedOrderId !== orderId) {
      throw new ForbiddenException('Order access denied — invalid guest token');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { restaurant: { select: { tenantId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Check if feedback already submitted
    const existing = await this.prisma.review.findFirst({
      where: { orderId, restaurantId },
    });
    if (existing) {
      return { message: 'Feedback already submitted. Thank you!', reviewId: existing.id };
    }

    const review = await this.prisma.review.create({
      data: {
        tenantId: order.restaurant.tenantId,
        restaurantId,
        orderId,
        customerId: order.customerId ?? null,
        rating: dto.rating,
        comment: dto.comment ?? null,
        channel: order.channel,
        isApproved: true, // Auto-approve QR in-dining feedback
      },
    });

    this.logger.log(`QR feedback submitted — order ${order.orderNumber} — rating ${dto.rating}/5`);

    return {
      message: 'Thank you for your feedback!',
      reviewId: review.id,
      rating: review.rating,
    };
  }

  // ─── All active carts at a table (un-ordered guests) ─────────────────────

  async getTableCarts(restaurantId: string, tableId: string) {
    const setKey = TABLE_TOKENS_KEY(restaurantId, tableId);
    const tokens: string[] = await this.redis.smembers(setKey);
    const carts: Cart[] = [];
    for (const token of tokens) {
      const cart = await this.redis.getJson<Cart>(CART_KEY(restaurantId, token));
      if (cart && cart.items.length > 0) carts.push(cart);
    }
    return carts.map((c) => ({
      guestToken: c.guestToken,
      guestName: c.guestName ?? null,
      itemCount: c.items.reduce((s, i) => s + i.quantity, 0),
      subtotal: c.subtotal,
      subtotalEstimate: c.subtotal,
      items: c.items.map((i) => ({
        cartItemId: i.cartItemId,
        name: i.name,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
        modifiers: i.modifiers ?? [],
      })),
    }));
  }

  // ─── Session summary (all rounds in a table session) ─────────────────────

  async getSessionSummary(restaurantId: string, guestToken: string) {
    const storedOrderId = await this.redis.get(ORDER_KEY(restaurantId, guestToken));
    if (!storedOrderId) throw new ForbiddenException('Invalid guest token');

    const anchor = await this.prisma.order.findFirst({
      where: { id: storedOrderId, restaurantId },
      select: { tableSessionId: true },
    });

    if (!anchor?.tableSessionId) {
      const single = await this.prisma.order.findUnique({
        where: { id: storedOrderId },
        include: { items: { where: { isVoid: false }, orderBy: { createdAt: 'asc' } } },
      });
      if (!single) throw new NotFoundException('Order not found');
      return {
        sessionTotal: Number(single.totalAmount),
        orderCount: 1,
        orders: [{
          round: 1,
          orderId: single.id,
          orderNumber: single.orderNumber,
          status: single.status,
          guestName: single.guestName ?? null,
          placedAt: single.createdAt,
          subtotal: Number(single.subtotal),
          totalAmount: Number(single.totalAmount),
          items: (single.items as any[]).map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            totalPrice: Number(i.totalPrice),
          })),
        }],
      };
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tableSessionId: anchor.tableSessionId,
        restaurantId,
        status: { notIn: ['CANCELLED', 'REFUNDED'] as any },
      },
      include: { items: { where: { isVoid: false }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const sessionTotal = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    return {
      sessionTotal,
      orderCount: orders.length,
      orders: orders.map((o, idx) => ({
        round: idx + 1,
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        guestName: o.guestName ?? null,
        placedAt: o.createdAt,
        subtotal: Number(o.subtotal),
        totalAmount: Number(o.totalAmount),
        items: (o.items as any[]).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
        })),
      })),
    };
  }

  // ─── M12.12 Generate QR code (staff) ─────────────────────────────────────

  async generateQrCode(tenantId: string, restaurantId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId, tenantId },
    });
    if (!table) throw new NotFoundException('Table not found');

    const qrToken = uuidv4();
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { qrBaseUrl: true },
    });
    const baseUrl = (restaurant?.qrBaseUrl ?? 'https://order.restrocloud.com').replace(/\/$/, '');
    const qrUrl = `${baseUrl}/table/${restaurantId}/${tableId}`;

    const qrDataUri = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
    });

    await this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: { qrCode: qrToken },
    });

    this.logger.log(`QR code generated for table ${table.tableNumber} — restaurant ${restaurantId}`);

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      qrToken,
      qrUrl,
      qrDataUri,
    };
  }

  // ─── Cron: auto-close orphaned QR sessions ────────────────────────────────
  /**
   * Runs every 10 minutes.
   * A session is "orphaned" when all customers closed their browser without
   * placing an order: the session is OPEN, has zero orders, and has been idle
   * for more than 30 minutes.
   * We close it and reset the table to AVAILABLE so the next party can scan.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async closeOrphanedSessions() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    try {
      const orphaned = await this.prisma.tableSession.findMany({
        where: {
          status: SessionStatus.OPEN,
          openedAt: { lt: cutoff },
          orders: { none: {} },
        },
        select: { id: true, tableId: true },
      });

      for (const session of orphaned) {
        try {
          await this.prisma.$transaction([
            this.prisma.tableSession.update({
              where: { id: session.id },
              data: { status: SessionStatus.CLOSED, closedAt: new Date() },
            }),
            this.prisma.restaurantTable.update({
              where: { id: session.tableId },
              data: { status: TableStatus.AVAILABLE },
            }),
          ]);
          this.logger.log(`Auto-closed orphaned session ${session.id} (table ${session.tableId})`);
        } catch (err) {
          this.logger.error(`Failed to close orphaned session ${session.id}: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`closeOrphanedSessions cron error: ${err.message}`);
    }
  }
}
