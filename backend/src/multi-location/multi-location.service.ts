import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole, TransferStatus } from '@prisma/client';
import { CreateLocationDto } from './dto/create-location.dto';
import { SetPriceOverrideDto } from './dto/price-override.dto';
import { CreateStockTransferDto, ReceiveTransferDto } from './dto/stock-transfer.dto';
import { ConsolidatedQueryDto } from './dto/consolidated-query.dto';

@Injectable()
export class MultiLocationService {
  constructor(private prisma: PrismaService) {}

  // ── M24.1 — Location CRUD ─────────────────────────────────────────────────

  async listLocations(tenantId: string) {
    return this.prisma.restaurant.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true, users: true } },
      },
    });
  }

  async createLocation(tenantId: string, dto: CreateLocationDto) {
    const existing = await this.prisma.restaurant.findFirst({
      where: { tenantId, slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" already used in this tenant`);
    }

    return this.prisma.restaurant.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        timezone: dto.timezone ?? 'Asia/Dhaka',
      },
    });
  }

  async toggleLocationActive(tenantId: string, restaurantId: string, isActive: boolean) {
    await this.requireLocation(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ── M24.2 — Consolidated dashboard ───────────────────────────────────────

  async getConsolidatedDashboard(tenantId: string) {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const locationData = await Promise.all(
      restaurants.map(async (r) => {
        const [orders, revenue] = await Promise.all([
          this.prisma.order.count({
            where: {
              restaurantId: r.id,
              createdAt: { gte: todayStart, lte: todayEnd },
              status: { notIn: ['CANCELLED', 'REFUNDED'] },
            },
          }),
          this.prisma.order.aggregate({
            where: {
              restaurantId: r.id,
              createdAt: { gte: todayStart, lte: todayEnd },
              status: { notIn: ['CANCELLED', 'REFUNDED'] },
            },
            _sum: { totalAmount: true },
          }),
        ]);

        const rev = Number(revenue._sum.totalAmount ?? 0);
        return {
          restaurantId: r.id,
          name: r.name,
          todayOrders: orders,
          todayRevenue: rev,
          avgOrderValue: orders > 0 ? rev / orders : 0,
        };
      }),
    );

    const totalRevenue = locationData.reduce((s, l) => s + l.todayRevenue, 0);
    const totalOrders = locationData.reduce((s, l) => s + l.todayOrders, 0);

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      locationCount: restaurants.length,
      locations: locationData.sort((a, b) => b.todayRevenue - a.todayRevenue),
    };
  }

  // ── M24.3 — Comparison / leaderboard ─────────────────────────────────────

  async getLocationComparison(tenantId: string, q: ConsolidatedQueryDto) {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, city: true },
    });

    const dateFrom = q.dateFrom ? new Date(q.dateFrom) : new Date(Date.now() - 30 * 86400000);
    const dateTo = q.dateTo ? new Date(q.dateTo) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const data = await Promise.all(
      restaurants.map(async (r) => {
        const [orderStats, customerCount, staffCount] = await Promise.all([
          this.prisma.order.aggregate({
            where: {
              restaurantId: r.id,
              createdAt: { gte: dateFrom, lte: dateTo },
              status: { notIn: ['CANCELLED', 'REFUNDED'] },
            },
            _sum: { totalAmount: true },
            _count: { _all: true },
          }),
          this.prisma.customer.count({ where: { restaurantId: r.id } }),
          this.prisma.user.count({ where: { restaurantId: r.id, isActive: true } }),
        ]);

        const revenue = Number(orderStats._sum.totalAmount ?? 0);
        const orders = orderStats._count._all;
        return {
          restaurantId: r.id,
          name: r.name,
          city: r.city,
          revenue,
          orders,
          avgOrderValue: orders > 0 ? revenue / orders : 0,
          customers: customerCount,
          staff: staffCount,
        };
      }),
    );

    // Rank by revenue
    const sorted = data.sort((a, b) => b.revenue - a.revenue);
    return sorted.map((loc, idx) => ({ rank: idx + 1, ...loc }));
  }

  // ── M24.4 — Global menu (all tenant items) ───────────────────────────────

  async getGlobalMenu(tenantId: string) {
    const items = await this.prisma.item.findMany({
      where: { tenantId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ restaurantId: 'asc' }, { name: 'asc' }],
    });

    // Group by name to identify shared vs unique items
    const byName = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.name.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(item);
    }

    return {
      items,
      itemCount: items.length,
      uniqueNameCount: byName.size,
    };
  }

  // ── M24.4 — Price overrides ───────────────────────────────────────────────

  async setPriceOverride(tenantId: string, dto: SetPriceOverrideDto) {
    await this.requireLocation(tenantId, dto.restaurantId);

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, tenantId },
    });
    if (!item) throw new NotFoundException('Item not found in this tenant');

    return this.prisma.menuPriceOverride.upsert({
      where: { restaurantId_itemId: { restaurantId: dto.restaurantId, itemId: dto.itemId } },
      update: { price: dto.price },
      create: { tenantId, restaurantId: dto.restaurantId, itemId: dto.itemId, price: dto.price },
    });
  }

  async listPriceOverrides(tenantId: string, restaurantId?: string) {
    return this.prisma.menuPriceOverride.findMany({
      where: { tenantId, ...(restaurantId ? { restaurantId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePriceOverride(tenantId: string, overrideId: string) {
    const override = await this.prisma.menuPriceOverride.findFirst({
      where: { id: overrideId, tenantId },
    });
    if (!override) throw new NotFoundException('Price override not found');
    await this.prisma.menuPriceOverride.delete({ where: { id: overrideId } });
    return { deleted: true };
  }

  // ── M24.5 — Stock transfers ───────────────────────────────────────────────

  async createStockTransfer(tenantId: string, userId: string, dto: CreateStockTransferDto) {
    if (dto.fromRestaurantId === dto.toRestaurantId) {
      throw new BadRequestException('Source and destination must be different locations');
    }

    await Promise.all([
      this.requireLocation(tenantId, dto.fromRestaurantId),
      this.requireLocation(tenantId, dto.toRestaurantId),
    ]);

    // Verify ingredient exists at source and has enough stock
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: dto.ingredientId, restaurantId: dto.fromRestaurantId, tenantId },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found at source location');
    if (ingredient.currentStock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock: ${ingredient.currentStock} ${ingredient.unit} available, requested ${dto.quantity}`,
      );
    }

    // Deduct from source immediately; add to destination on receive
    const [transfer] = await this.prisma.$transaction([
      this.prisma.stockTransfer.create({
        data: {
          tenantId,
          fromRestaurantId: dto.fromRestaurantId,
          toRestaurantId: dto.toRestaurantId,
          ingredientId: dto.ingredientId,
          quantity: dto.quantity,
          notes: dto.notes,
          initiatedBy: userId,
        },
      }),
      this.prisma.ingredient.update({
        where: { id: dto.ingredientId },
        data: { currentStock: { decrement: dto.quantity } },
      }),
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          restaurantId: dto.fromRestaurantId,
          ingredientId: dto.ingredientId,
          type: 'ADJUSTMENT',
          quantity: -dto.quantity,
          notes: `Transfer to location (pending)`,
          createdById: userId,
        },
      }),
    ]);

    return transfer;
  }

  async listStockTransfers(
    tenantId: string,
    q: { restaurantId?: string; status?: TransferStatus },
  ) {
    const where: any = { tenantId };
    if (q.restaurantId) {
      where.OR = [{ fromRestaurantId: q.restaurantId }, { toRestaurantId: q.restaurantId }];
    }
    if (q.status) where.status = q.status;

    const transfers = await this.prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with names
    const rids = [...new Set([...transfers.map((t) => t.fromRestaurantId), ...transfers.map((t) => t.toRestaurantId)])];
    const ingredientIds = [...new Set(transfers.map((t) => t.ingredientId))];

    const [restaurants, ingredients] = await Promise.all([
      this.prisma.restaurant.findMany({ where: { id: { in: rids } }, select: { id: true, name: true } }),
      this.prisma.ingredient.findMany({ where: { id: { in: ingredientIds } }, select: { id: true, name: true, unit: true } }),
    ]);

    const ridMap = new Map(restaurants.map((r) => [r.id, r.name]));
    const ingMap = new Map(ingredients.map((i) => [i.id, { name: i.name, unit: i.unit }]));

    return transfers.map((t) => ({
      ...t,
      fromName: ridMap.get(t.fromRestaurantId) ?? t.fromRestaurantId,
      toName: ridMap.get(t.toRestaurantId) ?? t.toRestaurantId,
      ingredient: ingMap.get(t.ingredientId),
    }));
  }

  async receiveStockTransfer(
    tenantId: string,
    transferId: string,
    userId: string,
    dto: ReceiveTransferDto,
  ) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING) {
      throw new ConflictException('Transfer is not in PENDING status');
    }

    // Verify receiving user is at destination restaurant
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { restaurantId: true, role: true } });
    const allowedRoles: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
    if (!allowedRoles.includes(user?.role as UserRole) && user?.restaurantId !== transfer.toRestaurantId) {
      throw new ForbiddenException('You can only receive transfers for your restaurant');
    }

    // Find or create ingredient at destination
    let destIngredient = await this.prisma.ingredient.findFirst({
      where: { id: transfer.ingredientId, restaurantId: transfer.toRestaurantId },
    });

    const sourceIngredient = await this.prisma.ingredient.findUnique({
      where: { id: transfer.ingredientId },
    });

    const txOps: any[] = [
      this.prisma.stockTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.RECEIVED, receivedBy: userId, receivedAt: new Date(), notes: dto.notes ?? transfer.notes },
      }),
    ];

    if (destIngredient) {
      txOps.push(
        this.prisma.ingredient.update({
          where: { id: destIngredient.id },
          data: { currentStock: { increment: transfer.quantity } },
        }),
      );
    } else if (sourceIngredient) {
      // Clone ingredient to destination restaurant
      txOps.push(
        this.prisma.ingredient.create({
          data: {
            tenantId,
            restaurantId: transfer.toRestaurantId,
            name: sourceIngredient.name,
            unit: sourceIngredient.unit,
            currentStock: transfer.quantity,
            lowStockThreshold: sourceIngredient.lowStockThreshold,
          },
        }),
      );
    }

    txOps.push(
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          restaurantId: transfer.toRestaurantId,
          ingredientId: transfer.ingredientId,
          type: 'PURCHASE',
          quantity: transfer.quantity,
          notes: `Received transfer from location`,
          createdById: userId,
        },
      }),
    );

    const [updatedTransfer] = await this.prisma.$transaction(txOps);
    return updatedTransfer;
  }

  async cancelStockTransfer(tenantId: string, transferId: string, userId: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING) {
      throw new ConflictException('Only PENDING transfers can be cancelled');
    }

    // Restore stock to source
    await this.prisma.$transaction([
      this.prisma.stockTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELLED },
      }),
      this.prisma.ingredient.update({
        where: { id: transfer.ingredientId },
        data: { currentStock: { increment: transfer.quantity } },
      }),
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          restaurantId: transfer.fromRestaurantId,
          ingredientId: transfer.ingredientId,
          type: 'ADJUSTMENT',
          quantity: transfer.quantity,
          notes: 'Transfer cancelled — stock restored',
          createdById: userId,
        },
      }),
    ]);

    return { cancelled: true };
  }

  // ── M24.7 — Cross-location staff ─────────────────────────────────────────

  async getAllStaff(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, role: { not: UserRole.SUPER_ADMIN } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        restaurantId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const restaurants = await this.prisma.restaurant.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const ridMap = new Map(restaurants.map((r) => [r.id, r.name]));

    return users.map((u) => ({
      ...u,
      restaurantName: u.restaurantId ? (ridMap.get(u.restaurantId) ?? 'Unknown') : null,
    }));
  }

  // ── M24.7 — Assign staff to location ─────────────────────────────────────

  async assignStaffToLocation(tenantId: string, userId: string, restaurantId: string) {
    await this.requireLocation(tenantId, restaurantId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { restaurantId },
      select: { id: true, firstName: true, lastName: true, role: true, restaurantId: true },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async requireLocation(tenantId: string, restaurantId: string) {
    const r = await this.prisma.restaurant.findFirst({ where: { id: restaurantId, tenantId } });
    if (!r) throw new NotFoundException('Location not found');
    return r;
  }
}
