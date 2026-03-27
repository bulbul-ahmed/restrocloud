import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { OrderType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { OrdersService } from '../orders/orders.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { OnlineCartAddItemDto } from './dto/online-cart-add-item.dto';
import { OnlineCartUpdateItemDto } from './dto/online-cart-update-item.dto';
import { PlaceOnlineOrderDto } from './dto/place-online-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ListRestaurantsQueryDto } from './dto/list-restaurants-query.dto';
import { CustomerJwtPayload } from './strategies/customer-jwt.strategy';
import { CreateAddressDto, UpdateAddressDto } from './dto/customer-address.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { OnlineLoyaltyService } from './loyalty/online-loyalty.service';

// ─── Redis key helpers ─────────────────────────────────────────────────────
const CART_KEY = (restaurantId: string, token: string) =>
  `online:cart:${restaurantId}:${token}`;
const CART_TTL = 60 * 60 * 2; // 2 hours

// ─── Cart types ────────────────────────────────────────────────────────────
export interface OnlineCartModifier {
  modifierId: string;
  name: string;
  priceAdjust: number;
}
export interface OnlineCartItem {
  cartItemId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: OnlineCartModifier[];
  notes?: string;
  totalPrice: number;
}
export interface OnlineCart {
  restaurantId: string;
  cartToken: string;
  customerId?: string;
  items: OnlineCartItem[];
  subtotal: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class OnlineOrderingService {
  private readonly logger = new Logger(OnlineOrderingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private config: ConfigService,
    private ordersService: OrdersService,
    private loyaltyService: OnlineLoyaltyService,
  ) {}

  // ─── M13.12 Restaurant discovery ────────────────────────────────────────
  async listRestaurants(query: ListRestaurantsQueryDto) {
    const { city, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      publicSlug: { not: null },
    };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [restaurants, total] = await this.prisma.$transaction([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          publicSlug: true,
          description: true,
          logoUrl: true,
          city: true,
          country: true,
          currency: true,
          orderTypes: true,
          deliveryFee: true,
          minimumOrderAmount: true,
          estimatedDeliveryMin: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── M13.1 Restaurant lookup by publicSlug ──────────────────────────────
  async getRestaurantBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: {
        id: true,
        name: true,
        publicSlug: true,
        description: true,
        logoUrl: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        country: true,
        timezone: true,
        locale: true,
        currency: true,
        taxRate: true,
        taxInclusive: true,
        serviceCharge: true,
        operatingHours: true,
        orderTypes: true,
        tipOptions: true,
        deliveryFee: true,
        minimumOrderAmount: true,
        deliveryRadiusKm: true,
        estimatedDeliveryMin: true,
        brandColor: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  // ─── M13.2 Public menu by slug ──────────────────────────────────────────
  async getMenuBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true, name: true, currency: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const categories = await this.prisma.category.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
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
            },
          },
        },
      },
    });

    const transformed = categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => ({
        ...item,
        modifierGroups: item.modifierGroups.map((mg) => this.normalizeModifierGroup(mg.modifierGroup)),
      })),
    }));

    return { restaurant, categories: transformed };
  }

  private normalizeModifierGroup(mg: any) {
    return {
      ...mg,
      minSelections: mg.minSelect ?? 0,
      maxSelections: mg.maxSelect ?? 1,
      modifiers: (mg.modifiers ?? []).map((m: any) => ({
        ...m,
        priceAdjustment: Number(m.priceAdjustment ?? 0),
      })),
    };
  }

  // ─── M13.3 Item detail by slug ──────────────────────────────────────────
  async getItemBySlug(slug: string, itemId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, restaurantId: restaurant.id, isAvailable: true },
      include: {
        category: { select: { id: true, name: true } },
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
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return {
      ...item,
      price: Number(item.price),
      modifierGroups: item.modifierGroups.map((mg) => this.normalizeModifierGroup(mg.modifierGroup)),
    };
  }

  // ─── M13.4 Customer auth helpers ────────────────────────────────────────

  private signCustomerJwt(payload: CustomerJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '24h',
    });
  }

  async registerCustomer(slug: string, dto: RegisterCustomerDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true, tenantId: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // Check uniqueness
    const existing = await this.prisma.customer.findFirst({
      where: {
        restaurantId: restaurant.id,
        OR: [
          { email: dto.email },
          { phone: dto.phone },
        ],
      },
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customer = await this.prisma.customer.create({
      data: {
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        isVerified: true, // MVP: skip email verification
        lastLoginAt: new Date(),
      },
    });

    // Auto-create loyalty account on registration
    await this.prisma.loyaltyAccount.create({
      data: { tenantId: restaurant.tenantId, customerId: customer.id, points: 0, totalEarned: 0, totalRedeemed: 0, tier: 'BRONZE' },
    });

    const payload: CustomerJwtPayload = {
      sub: customer.id,
      restaurantId: customer.restaurantId,
      tenantId: customer.tenantId,
      email: customer.email!,
      type: 'customer',
    };

    return {
      accessToken: this.signCustomerJwt(payload),
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }

  async loginCustomer(slug: string, dto: LoginCustomerDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true, tenantId: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const customer = await this.prisma.customer.findFirst({
      where: { restaurantId: restaurant.id, email: dto.email },
    });
    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (customer.isBlacklisted) throw new ForbiddenException('Account suspended');

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: CustomerJwtPayload = {
      sub: customer.id,
      restaurantId: customer.restaurantId,
      tenantId: customer.tenantId,
      email: customer.email!,
      type: 'customer',
    };

    return {
      accessToken: this.signCustomerJwt(payload),
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }

  async getCustomerProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        loyaltyAccount: {
          select: { points: true, tier: true, totalEarned: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // ─── M13.5 Online cart management ───────────────────────────────────────

  private async requireCart(restaurantId: string, cartToken: string): Promise<OnlineCart> {
    const raw = await this.redis.get(CART_KEY(restaurantId, cartToken));
    if (!raw) throw new NotFoundException('Cart not found or expired');
    const cart = JSON.parse(raw) as OnlineCart;
    // Backfill itemCount for carts stored before this field was added
    if (cart.itemCount === undefined) {
      cart.itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
    }
    return cart;
  }

  private async saveCart(cart: OnlineCart): Promise<void> {
    cart.updatedAt = new Date().toISOString();
    cart.subtotal = cart.items.reduce((s, i) => s + i.totalPrice, 0);
    cart.itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
    await this.redis.set(CART_KEY(cart.restaurantId, cart.cartToken), JSON.stringify(cart), CART_TTL);
  }

  async initOnlineCart(restaurantId: string, customerId?: string): Promise<OnlineCart> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isActive: true },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const cartToken = uuidv4();
    const cart: OnlineCart = {
      restaurantId,
      cartToken,
      customerId,
      items: [],
      subtotal: 0,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(CART_KEY(restaurantId, cartToken), JSON.stringify(cart), CART_TTL);
    return cart;
  }

  async addToOnlineCart(restaurantId: string, dto: OnlineCartAddItemDto): Promise<OnlineCart> {
    const cart = await this.requireCart(restaurantId, dto.cartToken);

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, restaurantId, isAvailable: true },
      include: {
        modifierGroups: {
          include: { modifierGroup: { include: { modifiers: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not available');

    const allModifiers = item.modifierGroups.flatMap(
      (mg) => mg.modifierGroup.modifiers,
    );

    const resolvedModifiers: OnlineCartModifier[] = [];
    for (const m of dto.modifiers ?? []) {
      const mod = allModifiers.find((x) => x.id === m.modifierId);
      if (!mod || !mod.isAvailable) throw new BadRequestException(`Modifier ${m.modifierId} not available`);
      resolvedModifiers.push({
        modifierId: mod.id,
        name: mod.name,
        priceAdjust: Number(mod.priceAdjustment),
      });
    }

    const unitPrice =
      Number(item.price) + resolvedModifiers.reduce((s, m) => s + m.priceAdjust, 0);

    cart.items.push({
      cartItemId: uuidv4(),
      itemId: item.id,
      name: item.name,
      quantity: dto.quantity,
      unitPrice,
      modifiers: resolvedModifiers,
      notes: dto.notes,
      totalPrice: unitPrice * dto.quantity,
    });

    await this.saveCart(cart);
    return cart;
  }

  async updateOnlineCartItem(
    restaurantId: string,
    cartItemId: string,
    dto: OnlineCartUpdateItemDto,
  ): Promise<OnlineCart> {
    const cart = await this.requireCart(restaurantId, dto.cartToken);
    const idx = cart.items.findIndex((i) => i.cartItemId === cartItemId);
    if (idx === -1) throw new NotFoundException('Cart item not found');

    cart.items[idx].quantity = dto.quantity;
    cart.items[idx].totalPrice = cart.items[idx].unitPrice * dto.quantity;
    await this.saveCart(cart);
    return cart;
  }

  async removeOnlineCartItem(
    restaurantId: string,
    cartItemId: string,
    cartToken: string,
  ): Promise<OnlineCart> {
    const cart = await this.requireCart(restaurantId, cartToken);
    const idx = cart.items.findIndex((i) => i.cartItemId === cartItemId);
    if (idx === -1) throw new NotFoundException('Cart item not found');
    cart.items.splice(idx, 1);
    await this.saveCart(cart);
    return cart;
  }

  async getOnlineCart(restaurantId: string, cartToken: string): Promise<OnlineCart> {
    return this.requireCart(restaurantId, cartToken);
  }

  // ─── M13.7 Place online order ────────────────────────────────────────────

  private isRestaurantOpen(operatingHours: any, timezone: string): boolean {
    if (!operatingHours) return true; // no hours configured — always open
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: timezone }),
    );
    const dayKey = days[now.getDay()];
    const regular = operatingHours.regularHours ?? operatingHours;
    const dayConfig = regular[dayKey];
    if (!dayConfig || dayConfig.closed) return false;
    const [oh, om] = dayConfig.open.split(':').map(Number);
    const [ch, cm] = dayConfig.close.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= oh * 60 + om && currentMinutes < ch * 60 + cm;
  }

  async placeOnlineOrder(slug: string, dto: PlaceOnlineOrderDto, customerId?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // Delivery requires address
    if (dto.orderType === 'DELIVERY' && !dto.deliveryAddress) {
      throw new BadRequestException('Delivery address required for DELIVERY orders');
    }

    // Operating hours check
    if (!this.isRestaurantOpen(restaurant.operatingHours, restaurant.timezone)) {
      throw new BadRequestException('Restaurant is currently closed');
    }

    const cart = await this.requireCart(restaurant.id, dto.cartToken);
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');

    // Min order check
    if (restaurant.minimumOrderAmount) {
      const min = Number(restaurant.minimumOrderAmount);
      if (cart.subtotal < min) {
        throw new BadRequestException(
          `Minimum order amount is ${min} ${restaurant.currency}`,
        );
      }
    }

    // Build createOrder DTO items
    const orderItems = cart.items.map((ci) => ({
      itemId: ci.itemId,
      quantity: ci.quantity,
      unitPrice: ci.unitPrice,
      notes: ci.notes,
      modifiers: ci.modifiers.map((m) => ({
        modifierId: m.modifierId,
        name: m.name,
        priceAdjustment: m.priceAdjust,
      })),
    }));

    const deliveryFee =
      dto.orderType === 'DELIVERY' && restaurant.deliveryFee
        ? Number(restaurant.deliveryFee)
        : 0;

    const order = await this.ordersService.createOrder(
      restaurant.tenantId,
      restaurant.id,
      null, // no staff userId for online orders
      {
        channel: OrderType.ONLINE,
        customerId: customerId ?? undefined,
        items: orderItems,
        tipAmount: dto.tipAmount,
        notes: dto.notes,
      } as any,
    );

    // Save delivery address, cartToken, and guest info on order
    if (dto.deliveryAddress || cart.cartToken || dto.guestName || dto.guestPhone) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryAddress: dto.deliveryAddress ? (dto.deliveryAddress as any) : undefined,
          cartToken: cart.cartToken,
          guestName: dto.guestName ?? undefined,
          guestPhone: dto.guestPhone ?? undefined,
        },
      });
    }

    // ─── M15.2 Loyalty redemption ───────────────────────────────────────────
    let loyaltyDiscount = 0;
    if (dto.redeemPoints && dto.redeemPoints > 0 && customerId) {
      loyaltyDiscount = await this.loyaltyService.redeemForOnlineOrder(
        restaurant.tenantId,
        restaurant.id,
        customerId,
        order.id,
        dto.redeemPoints,
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { totalAmount: { decrement: loyaltyDiscount } },
      });
    }

    // Clear cart after successful placement
    await this.redis.del(CART_KEY(restaurant.id, dto.cartToken));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      deliveryFee,
      loyaltyDiscount,
    };
  }

  // ─── M13.8 Track order ───────────────────────────────────────────────────
  async trackOnlineOrder(slug: string, orderId: string, cartToken?: string, customerId?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id },
      include: {
        items: {
          include: { modifiers: true },
        },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Ownership: either cartToken matches or customerId matches
    if (
      order.cartToken !== cartToken &&
      order.customerId !== customerId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  // ─── M13.9 Customer order history ───────────────────────────────────────
  async getOrderHistory(
    customerId: string,
    restaurantId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { customerId, restaurantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { modifiers: true } },
          payments: { select: { method: true, status: true, amount: true } },
        },
      }),
      this.prisma.order.count({ where: { customerId, restaurantId } }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── M13.10 Customer profile update ─────────────────────────────────────
  async updateCustomerProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;

    // Email or password change requires current password verification
    if (dto.email || dto.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to change email or password');
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { passwordHash: true },
      });
      if (!customer?.passwordHash) throw new BadRequestException('No password set on this account');
      const valid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
      if (!valid) throw new BadRequestException('Current password is incorrect');

      if (dto.email) data.email = dto.email;
      if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        updatedAt: true,
      },
    });
  }

  // ─── M13.11 Reviews ──────────────────────────────────────────────────────
  async getReviews(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.prisma.review.findMany({
      where: { restaurantId: restaurant.id, isApproved: true, isHidden: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async createReview(
    slug: string,
    customerId: string,
    tenantId: string,
    restaurantId: string,
    dto: CreateReviewDto,
  ) {
    // Verify restaurant matches slug
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant || restaurant.id !== restaurantId) {
      throw new ForbiddenException('Restaurant mismatch');
    }

    // Verify orderId belongs to customer if provided
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, customerId, restaurantId },
      });
      if (!order) throw new BadRequestException('Order not found or not yours');
    }

    return this.prisma.review.create({
      data: {
        tenantId,
        restaurantId,
        customerId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,
        isApproved: false, // requires moderation
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        isApproved: true,
        createdAt: true,
      },
    });
  }

  // ─── M15.3 Customer address book ─────────────────────────────────────────
  async listAddresses(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(tenantId: string, customerId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: {
        tenantId,
        customerId,
        label: dto.label,
        line1: dto.line1,
        line2: dto.line2,
        city: dto.city,
        area: dto.area,
        postalCode: dto.postalCode,
        country: dto.country ?? 'BD',
        lat: dto.lat,
        lng: dto.lng,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.update({
      where: { id: addressId },
      data: dto as any,
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);
    return this.prisma.address.findUnique({ where: { id: addressId } });
  }

  // ─── M15.4 Reorder ───────────────────────────────────────────────────────
  async reorder(slug: string, orderId: string, customerId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id, customerId },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, price: true, isAvailable: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Create fresh cart and populate with previous items
    const cart = await this.initOnlineCart(restaurant.id);
    const orderItems = (order as any).items as any[];

    for (const oi of orderItems) {
      if (!oi.item?.isAvailable) continue; // skip unavailable items
      await this.addToOnlineCart(restaurant.id, {
        cartToken: cart.cartToken,
        itemId: oi.itemId,
        quantity: oi.quantity,
        notes: oi.notes,
        modifiers: [],
      });
    }

    return { cartToken: cart.cartToken, message: 'Cart created from previous order' };
  }

  // ─── M15.6 Order receipt ─────────────────────────────────────────────────
  async getOrderReceipt(slug: string, orderId: string, customerId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true, name: true, currency: true, taxRate: true, address: true, phone: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id, customerId },
      include: {
        items: { include: { modifiers: true } },
        payments: { where: { status: 'COMPLETED' } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      channel: order.channel,
      createdAt: order.createdAt,
      currency: restaurant.currency,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
      })),
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      serviceCharge: Number(order.serviceCharge),
      tipAmount: Number(order.tipAmount),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      payments: order.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        status: p.status,
      })),
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
      },
      customer: order.customer
        ? { firstName: order.customer.firstName, lastName: order.customer.lastName, email: order.customer.email, phone: order.customer.phone }
        : null,
    };
  }

  // ─── M15.7 Review moderation (staff) ─────────────────────────────────────
  async listReviewsForStaff(
    tenantId: string,
    restaurantId: string,
    query: ListReviewsQueryDto,
  ) {
    const { status = 'all', rating, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };
    if (rating) where.rating = rating;
    if (status === 'pending')  { where.isApproved = false; where.isHidden = false; }
    if (status === 'approved') { where.isApproved = true;  where.isHidden = false; }
    if (status === 'hidden')   { where.isHidden = true; }

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async moderateReview(
    tenantId: string,
    restaurantId: string,
    reviewId: string,
    action: 'approve' | 'reject',
  ) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, tenantId, restaurantId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        isApproved: action === 'approve',
        isHidden: action === 'reject',
      },
    });
  }

  async getReviewStats(tenantId: string, restaurantId: string) {
    const [total, pending, approved, hidden, avgResult] = await Promise.all([
      this.prisma.review.count({ where: { tenantId, restaurantId } }),
      this.prisma.review.count({ where: { tenantId, restaurantId, isApproved: false, isHidden: false } }),
      this.prisma.review.count({ where: { tenantId, restaurantId, isApproved: true, isHidden: false } }),
      this.prisma.review.count({ where: { tenantId, restaurantId, isHidden: true } }),
      this.prisma.review.aggregate({ where: { tenantId, restaurantId, isApproved: true }, _avg: { rating: true } }),
    ]);
    return { total, pending, approved, hidden, averageRating: avgResult._avg.rating ?? 0 };
  }

  // ─── M15.10 Account deletion (GDPR) ──────────────────────────────────────
  async deleteAccount(customerId: string, dto: DeleteAccountDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, passwordHash: true },
    });
    if (!customer) throw new NotFoundException('Account not found');
    if (!customer.passwordHash) throw new BadRequestException('No password set on this account');

    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) throw new BadRequestException('Incorrect password');

    // Delete customer — Prisma cascades to: addresses, loyaltyAccount,
    // savedPaymentMethods, customerNotifications, reviews.
    // Orders: customerId set to null via SetNull rule.
    await this.prisma.customer.delete({ where: { id: customerId } });
    return { success: true, message: 'Account deleted' };
  }

  // ─── Public: enabled payment methods for checkout ───────────────────────
  async getPaymentMethods(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const configs = await this.prisma.paymentGatewayConfig.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      select: { gateway: true },
    });

    const GATEWAY_META: Record<string, { id: string; label: string }> = {
      STRIPE:     { id: 'stripe',     label: 'Card (Stripe)' },
      BKASH:      { id: 'bkash',      label: 'bKash' },
      SSLCOMMERZ: { id: 'sslcommerz', label: 'SSLCommerz' },
    };

    const gatewayMethods = configs
      .map((c) => GATEWAY_META[c.gateway])
      .filter(Boolean);

    // COD is always available unless explicitly disabled via a COD gateway config with isActive=false
    const codDisabled = await this.prisma.paymentGatewayConfig.findFirst({
      where: { restaurantId: restaurant.id, gateway: 'COD', isActive: false },
    });

    const methods = [
      ...(!codDisabled ? [{ id: 'cod', label: 'Cash on Delivery' }] : []),
      ...gatewayMethods,
    ];

    return { methods };
  }
}
