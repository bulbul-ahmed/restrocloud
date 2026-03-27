import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { MovementType, NotificationType, OrderStatus, POStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { LogWasteDto } from './dto/log-waste.dto';
import { StockTakeDto } from './dto/stock-take.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notifications: NotificationsService,
  ) {}

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async requireIngredient(tenantId: string, restaurantId: string, id: string) {
    const ing = await this.prisma.ingredient.findFirst({
      where: { id, tenantId, restaurantId, isActive: true },
    });
    if (!ing) throw new NotFoundException('Ingredient not found');
    return ing;
  }

  private async requireSupplier(tenantId: string, restaurantId: string, id: string) {
    const sup = await this.prisma.supplier.findFirst({
      where: { id, tenantId, restaurantId, isActive: true },
    });
    if (!sup) throw new NotFoundException('Supplier not found');
    return sup;
  }

  private async requirePO(tenantId: string, restaurantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, restaurantId },
      include: {
        supplier: true,
        items: { include: { ingredient: true } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  private async checkLowStock(tenantId: string, restaurantId: string, ingredientId: string): Promise<void> {
    try {
      const ing = await this.prisma.ingredient.findUnique({ where: { id: ingredientId } });
      if (!ing || ing.lowStockThreshold <= 0) return;
      if (ing.currentStock <= ing.lowStockThreshold) {
        await this.notifications.notify({
          tenantId,
          restaurantId,
          type: NotificationType.LOW_STOCK,
          title: `Low stock: ${ing.name}`,
          body: `${ing.name} is running low — current stock: ${ing.currentStock} ${ing.unit}`,
          data: { ingredientId, name: ing.name, currentStock: ing.currentStock, unit: ing.unit },
          targetRoles: [UserRole.MANAGER, UserRole.OWNER],
        });
      }
    } catch (err) {
      this.logger.warn(`Low stock check failed for ingredient ${ingredientId}: ${err.message}`);
    }
  }

  private invalidateReportCache(restaurantId: string) {
    this.redis.del(`inventory:${restaurantId}:food-cost`).catch(() => {});
    this.redis.del(`inventory:${restaurantId}:variance`).catch(() => {});
  }

  // ─── M20.1 Ingredients ───────────────────────────────────────────────────

  async createIngredient(tenantId: string, restaurantId: string, dto: CreateIngredientDto) {
    const ingredient = await this.prisma.ingredient.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        currentStock: dto.currentStock ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
        costPerUnit: dto.costPerUnit ?? 0,
      },
    });
    return ingredient;
  }

  async listIngredients(
    tenantId: string,
    restaurantId: string,
    query: { search?: string; category?: string; lowStockOnly?: string },
  ) {
    const where: any = { tenantId, restaurantId, isActive: true };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (query.lowStockOnly === 'true') {
      return ingredients.filter(
        (i) => i.lowStockThreshold > 0 && i.currentStock <= i.lowStockThreshold,
      );
    }
    return ingredients;
  }

  async getIngredient(tenantId: string, restaurantId: string, id: string) {
    return this.requireIngredient(tenantId, restaurantId, id);
  }

  async updateIngredient(tenantId: string, restaurantId: string, id: string, dto: UpdateIngredientDto) {
    await this.requireIngredient(tenantId, restaurantId, id);
    return this.prisma.ingredient.update({
      where: { id },
      data: dto,
    });
  }

  async deleteIngredient(tenantId: string, restaurantId: string, id: string) {
    await this.requireIngredient(tenantId, restaurantId, id);
    await this.prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Ingredient deleted' };
  }

  // ─── M20.2 Recipes ───────────────────────────────────────────────────────

  async setRecipe(tenantId: string, restaurantId: string, itemId: string, dto: SetRecipeDto) {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing recipe items for this menu item + tenant
      await tx.recipeItem.deleteMany({ where: { itemId, tenantId } });

      // Create new recipe items
      if (dto.items.length > 0) {
        await tx.recipeItem.createMany({
          data: dto.items.map((item) => ({
            tenantId,
            itemId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
    });

    return this.getRecipe(tenantId, restaurantId, itemId);
  }

  async getRecipe(tenantId: string, restaurantId: string, itemId: string) {
    const items = await this.prisma.recipeItem.findMany({
      where: { itemId, tenantId },
      include: { ingredient: true },
    });
    return { itemId, items };
  }

  async deleteRecipe(tenantId: string, restaurantId: string, itemId: string) {
    await this.prisma.recipeItem.deleteMany({ where: { itemId, tenantId } });
    return { message: 'Recipe deleted' };
  }

  // ─── M20.3 Auto-deduction (called from OrdersService on COMPLETED) ────────

  async deductForOrder(tenantId: string, restaurantId: string, orderId: string): Promise<void> {
    // Find all order items for this order
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { itemId: true, quantity: true },
    });

    for (const oi of orderItems) {
      if (!oi.itemId) continue;

      // Find recipe for this menu item
      const recipeItems = await this.prisma.recipeItem.findMany({
        where: { itemId: oi.itemId, tenantId },
      });

      if (recipeItems.length === 0) continue; // no recipe = skip

      for (const ri of recipeItems) {
        const deductQty = ri.quantity * oi.quantity;

        await this.prisma.$transaction([
          this.prisma.ingredient.update({
            where: { id: ri.ingredientId },
            data: { currentStock: { decrement: deductQty } },
          }),
          this.prisma.stockMovement.create({
            data: {
              tenantId,
              restaurantId,
              ingredientId: ri.ingredientId,
              type: MovementType.SALE,
              quantity: -deductQty,
              reason: `Order ${orderId}`,
              orderId,
            },
          }),
        ]);

        await this.checkLowStock(tenantId, restaurantId, ri.ingredientId);
      }
    }

    this.invalidateReportCache(restaurantId);
    this.logger.log(`Stock deducted for order ${orderId}`);
  }

  // ─── M20.5 Suppliers ─────────────────────────────────────────────────────

  async createSupplier(tenantId: string, restaurantId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { tenantId, restaurantId, ...dto },
    });
  }

  async listSuppliers(tenantId: string, restaurantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId, restaurantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(tenantId: string, restaurantId: string, id: string) {
    return this.requireSupplier(tenantId, restaurantId, id);
  }

  async updateSupplier(tenantId: string, restaurantId: string, id: string, dto: UpdateSupplierDto) {
    await this.requireSupplier(tenantId, restaurantId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async deleteSupplier(tenantId: string, restaurantId: string, id: string) {
    await this.requireSupplier(tenantId, restaurantId, id);
    await this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return { message: 'Supplier deleted' };
  }

  // ─── M20.6 Purchase Orders ───────────────────────────────────────────────

  async createPurchaseOrder(tenantId: string, restaurantId: string, dto: CreatePurchaseOrderDto) {
    const totalAmount = dto.items.reduce((sum, i) => sum + i.orderedQty * i.unitCost, 0);

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        restaurantId,
        supplierId: dto.supplierId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        notes: dto.notes as any,
        totalAmount,
        items: {
          create: dto.items.map((i) => ({
            ingredientId: i.ingredientId,
            orderedQty: i.orderedQty,
            unitCost: i.unitCost,
          })),
        },
      },
      include: {
        supplier: true,
        items: { include: { ingredient: true } },
      },
    });
  }

  async listPurchaseOrders(
    tenantId: string,
    restaurantId: string,
    query: { status?: POStatus; supplierId?: string },
  ) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        restaurantId,
        ...(query.status && { status: query.status }),
        ...(query.supplierId && { supplierId: query.supplierId }),
      },
      include: { supplier: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchaseOrder(tenantId: string, restaurantId: string, id: string) {
    return this.requirePO(tenantId, restaurantId, id);
  }

  async updatePurchaseOrder(
    tenantId: string,
    restaurantId: string,
    id: string,
    dto: Partial<{ notes: string; expectedDate: string; supplierId: string }>,
  ) {
    const po = await this.requirePO(tenantId, restaurantId, id);
    if (po.status !== POStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT purchase orders can be updated');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.expectedDate && { expectedDate: new Date(dto.expectedDate) }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    });
  }

  async cancelPurchaseOrder(tenantId: string, restaurantId: string, id: string) {
    const po = await this.requirePO(tenantId, restaurantId, id);
    if (!([POStatus.DRAFT, POStatus.SENT] as POStatus[]).includes(po.status)) {
      throw new BadRequestException('Only DRAFT or SENT purchase orders can be cancelled');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.CANCELLED },
      include: { supplier: true, items: { include: { ingredient: true } } },
    });
  }

  // ─── M20.7 Receive Stock ─────────────────────────────────────────────────

  async receivePurchaseOrder(
    tenantId: string,
    restaurantId: string,
    poId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    const po = await this.requirePO(tenantId, restaurantId, poId);

    if (!([POStatus.DRAFT, POStatus.SENT, POStatus.PARTIAL] as POStatus[]).includes(po.status)) {
      throw new BadRequestException('Cannot receive stock for this purchase order');
    }

    // Build a map of PO items by id
    const poItemMap = new Map(po.items.map((i) => [i.id, i]));

    for (const receive of dto.items) {
      const poItem = poItemMap.get(receive.purchaseOrderItemId);
      if (!poItem) {
        throw new NotFoundException(`PO item ${receive.purchaseOrderItemId} not found`);
      }

      const remainingQty = poItem.orderedQty - poItem.receivedQty;
      if (receive.receivedQty > remainingQty) {
        throw new BadRequestException(
          `Received qty (${receive.receivedQty}) exceeds remaining qty (${remainingQty}) for ingredient ${poItem.ingredient.name}`,
        );
      }

      await this.prisma.$transaction([
        this.prisma.purchaseOrderItem.update({
          where: { id: receive.purchaseOrderItemId },
          data: { receivedQty: { increment: receive.receivedQty } },
        }),
        this.prisma.ingredient.update({
          where: { id: poItem.ingredientId },
          data: { currentStock: { increment: receive.receivedQty } },
        }),
        this.prisma.stockMovement.create({
          data: {
            tenantId,
            restaurantId,
            ingredientId: poItem.ingredientId,
            type: MovementType.PURCHASE,
            quantity: receive.receivedQty,
            reason: `Purchase order ${poId}`,
            notes: `PO item ${receive.purchaseOrderItemId}`,
          },
        }),
      ]);
    }

    // Refresh PO to determine new status
    const updatedPO = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    const allReceived = updatedPO!.items.every((i) => i.receivedQty >= i.orderedQty);
    const newStatus = allReceived ? POStatus.RECEIVED : POStatus.PARTIAL;

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus },
    });

    this.invalidateReportCache(restaurantId);

    return this.requirePO(tenantId, restaurantId, poId);
  }

  // ─── M20.8 Stock Take ────────────────────────────────────────────────────

  async conductStockTake(tenantId: string, restaurantId: string, userId: string, dto: StockTakeDto) {
    const results: Array<{
      ingredientId: string;
      name: string;
      previousStock: number;
      physicalCount: number;
      variance: number;
    }> = [];

    for (const count of dto.counts) {
      const ing = await this.requireIngredient(tenantId, restaurantId, count.ingredientId);
      const variance = count.physicalCount - ing.currentStock;

      await this.prisma.$transaction([
        this.prisma.ingredient.update({
          where: { id: count.ingredientId },
          data: { currentStock: count.physicalCount },
        }),
        this.prisma.stockMovement.create({
          data: {
            tenantId,
            restaurantId,
            ingredientId: count.ingredientId,
            type: MovementType.STOCKTAKE,
            quantity: variance,
            reason: 'Physical stock take',
            createdById: userId,
          },
        }),
      ]);

      results.push({
        ingredientId: count.ingredientId,
        name: ing.name,
        previousStock: ing.currentStock,
        physicalCount: count.physicalCount,
        variance,
      });

      await this.checkLowStock(tenantId, restaurantId, count.ingredientId);
    }

    this.invalidateReportCache(restaurantId);
    return results;
  }

  // ─── M20.9 Waste Log ─────────────────────────────────────────────────────

  async logWaste(tenantId: string, restaurantId: string, userId: string, dto: LogWasteDto) {
    const ing = await this.requireIngredient(tenantId, restaurantId, dto.ingredientId);

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          restaurantId,
          ingredientId: dto.ingredientId,
          type: MovementType.WASTE,
          quantity: -dto.quantity,
          reason: dto.reason,
          notes: dto.notes,
          createdById: userId,
        },
      }),
      this.prisma.ingredient.update({
        where: { id: dto.ingredientId },
        data: { currentStock: { decrement: dto.quantity } },
      }),
    ]);

    await this.checkLowStock(tenantId, restaurantId, dto.ingredientId);
    this.invalidateReportCache(restaurantId);

    return movement;
  }

  // ─── Stock Movements list ─────────────────────────────────────────────────

  async listStockMovements(
    tenantId: string,
    restaurantId: string,
    query: {
      ingredientId?: string;
      type?: MovementType;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };
    if (query.ingredientId) where.ingredientId = query.ingredientId;
    if (query.type) where.type = query.type;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59.999Z') }),
      };
    }

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: { ingredient: { select: { name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, movements };
  }

  // ─── M20.10 Food Cost Report ──────────────────────────────────────────────

  async getFoodCostReport(tenantId: string, restaurantId: string, query: InventoryQueryDto) {
    const cacheKey = `inventory:${restaurantId}:food-cost:${query.dateFrom ?? ''}:${query.dateTo ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const dateFilter: any = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59.999Z') }),
      };
    }

    // Get all SALE movements in period
    const saleMoves = await this.prisma.stockMovement.findMany({
      where: { tenantId, restaurantId, type: MovementType.SALE, ...dateFilter },
      include: { ingredient: { select: { name: true, unit: true, costPerUnit: true } } },
    });

    // Group by ingredient
    const byIngredient = new Map<
      string,
      { ingredientId: string; name: string; unit: string; totalUsedQty: number; totalCost: number }
    >();

    let totalCogs = 0;
    for (const mv of saleMoves) {
      const usedQty = Math.abs(mv.quantity);
      const cost = usedQty * mv.ingredient.costPerUnit;
      totalCogs += cost;

      const existing = byIngredient.get(mv.ingredientId);
      if (existing) {
        existing.totalUsedQty += usedQty;
        existing.totalCost += cost;
      } else {
        byIngredient.set(mv.ingredientId, {
          ingredientId: mv.ingredientId,
          name: mv.ingredient.name,
          unit: mv.ingredient.unit,
          totalUsedQty: usedQty,
          totalCost: cost,
        });
      }
    }

    const completedOrders = await this.prisma.order.aggregate({
      where: {
        tenantId,
        restaurantId,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] },
        ...dateFilter,
      },
      _sum: { totalAmount: true },
    });

    const totalRevenue = Number(completedOrders._sum.totalAmount ?? 0);
    const foodCostPct = totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0;

    const byIngredientArr = Array.from(byIngredient.values()).map((i) => ({
      ...i,
      costPct: totalCogs > 0 ? (i.totalCost / totalCogs) * 100 : 0,
    }));

    const result = {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalRevenue,
      totalCogs,
      foodCostPct,
      byIngredient: byIngredientArr,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  // ─── M20.11 Usage Variance ───────────────────────────────────────────────

  async getUsageVariance(tenantId: string, restaurantId: string, query: InventoryQueryDto) {
    const cacheKey = `inventory:${restaurantId}:variance:${query.dateFrom ?? ''}:${query.dateTo ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const dateFilter: any = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59.999Z') }),
      };
    }

    // Actual usage = sum of SALE stock movements in period
    const saleMoves = await this.prisma.stockMovement.findMany({
      where: { tenantId, restaurantId, type: MovementType.SALE, ...dateFilter },
      include: { ingredient: { select: { name: true, unit: true } } },
    });

    const actualByIngredient = new Map<
      string,
      { name: string; unit: string; actualQty: number }
    >();

    for (const mv of saleMoves) {
      const usedQty = Math.abs(mv.quantity);
      const existing = actualByIngredient.get(mv.ingredientId);
      if (existing) {
        existing.actualQty += usedQty;
      } else {
        actualByIngredient.set(mv.ingredientId, {
          name: mv.ingredient.name,
          unit: mv.ingredient.unit,
          actualQty: usedQty,
        });
      }
    }

    // Theoretical usage = completed orders × recipe quantities
    const completedOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        restaurantId,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] },
        ...dateFilter,
      },
      include: { items: { select: { itemId: true, quantity: true } } },
    });

    const theoreticalByIngredient = new Map<string, number>();

    for (const order of completedOrders) {
      for (const oi of order.items) {
        if (!oi.itemId) continue;
        const recipe = await this.prisma.recipeItem.findMany({
          where: { itemId: oi.itemId, tenantId },
        });
        for (const ri of recipe) {
          const qty = ri.quantity * oi.quantity;
          theoreticalByIngredient.set(
            ri.ingredientId,
            (theoreticalByIngredient.get(ri.ingredientId) ?? 0) + qty,
          );
        }
      }
    }

    // Merge
    const allIngredientIds = new Set([
      ...Array.from(actualByIngredient.keys()),
      ...Array.from(theoreticalByIngredient.keys()),
    ]);

    const rows = await Promise.all(
      Array.from(allIngredientIds).map(async (ingredientId) => {
        const actual = actualByIngredient.get(ingredientId);
        const theoreticalQty = theoreticalByIngredient.get(ingredientId) ?? 0;
        const actualQty = actual?.actualQty ?? 0;
        const variance = actualQty - theoreticalQty;
        const variancePct = theoreticalQty > 0 ? (variance / theoreticalQty) * 100 : 0;

        let name = actual?.name;
        let unit = actual?.unit;
        if (!name) {
          const ing = await this.prisma.ingredient.findUnique({
            where: { id: ingredientId },
            select: { name: true, unit: true },
          });
          name = ing?.name ?? 'Unknown';
          unit = ing?.unit ?? 'PIECE';
        }

        return { ingredientId, name, unit, theoreticalQty, actualQty, variance, variancePct };
      }),
    );

    await this.redis.set(cacheKey, JSON.stringify(rows), 300);
    return rows;
  }
}
