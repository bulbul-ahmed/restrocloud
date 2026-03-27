import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderDto } from './dto/reorder-items.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ToggleAvailabilityDto } from './dto/toggle-availability.dto';
import { BulkAvailabilityDto } from './dto/bulk-availability.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { AttachModifierGroupDto } from './dto/attach-modifier-group.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
const OWNER_ROLES: UserRole[]   = [UserRole.OWNER, UserRole.SUPER_ADMIN];
const MENU_CACHE_TTL = 60; // seconds

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private cacheKey(restaurantId: string) {
    return `menu:full:${restaurantId}`;
  }

  async clearMenuCache(restaurantId: string) {
    await this.redis.del(this.cacheKey(restaurantId));
  }

  // ─── Private: resolve restaurant ─────────────────────────────────────────

  private async requireRestaurant(tenantId: string, restaurantId: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  private requireManagerRole(role: UserRole) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }
  }

  // ─── M3.1 Categories ─────────────────────────────────────────────────────

  async createCategory(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: CreateCategoryDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    const category = await this.prisma.category.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.clearMenuCache(restaurantId);
    return category;
  }

  async listCategories(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.category.findMany({
      where: { tenantId, restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getCategory(tenantId: string, restaurantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, restaurantId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(
    tenantId: string,
    restaurantId: string,
    categoryId: string,
    role: UserRole,
    dto: UpdateCategoryDto,
  ) {
    this.requireManagerRole(role);
    await this.getCategory(tenantId, restaurantId, categoryId); // ensures it exists

    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.clearMenuCache(restaurantId);
    return category;
  }

  async deleteCategory(
    tenantId: string,
    restaurantId: string,
    categoryId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.getCategory(tenantId, restaurantId, categoryId); // ensures it exists

    // Check for items in this category
    const itemCount = await this.prisma.item.count({
      where: { categoryId, tenantId },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${itemCount} item(s). Move or delete items first.`,
      );
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    await this.clearMenuCache(restaurantId);
  }

  async reorderCategories(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: ReorderDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    await this.prisma.$transaction(
      dto.items.map(({ id, sortOrder }) =>
        this.prisma.category.updateMany({
          where: { id, tenantId, restaurantId },
          data: { sortOrder },
        }),
      ),
    );

    await this.clearMenuCache(restaurantId);
    return { message: 'Categories reordered' };
  }

  // ─── M3.2 Items ───────────────────────────────────────────────────────────

  async createItem(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: CreateItemDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    // Verify category belongs to this restaurant
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId, restaurantId },
    });
    if (!category) throw new NotFoundException('Category not found in this restaurant');

    const item = await this.prisma.item.create({
      data: {
        tenantId,
        restaurantId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        costPrice: dto.costPrice,
        sku: dto.sku,
        barcode: dto.barcode,
        isAvailable: dto.isAvailable ?? true,
        isAlcohol: dto.isAlcohol ?? false,
        calories: dto.calories,
        allergens: dto.allergens ?? [],
        dietaryTags: dto.dietaryTags ?? [],
        sortOrder: dto.sortOrder ?? 0,
        preparationTime: dto.preparationTime,
      },
    });

    await this.clearMenuCache(restaurantId);
    return item;
  }

  async listItems(tenantId: string, restaurantId: string, query: ListItemsQueryDto) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.item.findMany({
      where: {
        tenantId,
        restaurantId,
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.isAvailable !== undefined && { isAvailable: query.isAvailable }),
        ...(query.search && {
          name: { contains: query.search, mode: 'insensitive' },
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { modifierGroups: true } },
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async getItem(tenantId: string, restaurantId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, tenantId, restaurantId },
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    childGroups: {
                      include: {
                        modifiers: {
                          orderBy: { sortOrder: 'asc' },
                          include: {
                            childGroups: {
                              include: {
                                modifiers: { orderBy: { sortOrder: 'asc' } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async updateItem(
    tenantId: string,
    restaurantId: string,
    itemId: string,
    role: UserRole,
    dto: UpdateItemDto,
  ) {
    this.requireManagerRole(role);
    await this.getItem(tenantId, restaurantId, itemId); // ensures it exists

    // Verify new category if provided
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId, restaurantId },
      });
      if (!cat) throw new NotFoundException('Target category not found in this restaurant');
    }

    const item = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isAlcohol !== undefined && { isAlcohol: dto.isAlcohol }),
        ...(dto.calories !== undefined && { calories: dto.calories }),
        ...(dto.allergens !== undefined && { allergens: dto.allergens }),
        ...(dto.dietaryTags !== undefined && { dietaryTags: dto.dietaryTags }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.preparationTime !== undefined && { preparationTime: dto.preparationTime }),
      },
    });

    await this.clearMenuCache(restaurantId);
    return item;
  }

  async deleteItem(
    tenantId: string,
    restaurantId: string,
    itemId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.getItem(tenantId, restaurantId, itemId); // ensures it exists

    await this.prisma.item.delete({ where: { id: itemId } });
    await this.clearMenuCache(restaurantId);
  }

  async toggleItemAvailability(
    tenantId: string,
    restaurantId: string,
    itemId: string,
    role: UserRole,
    dto: ToggleAvailabilityDto,
  ) {
    this.requireManagerRole(role);
    await this.getItem(tenantId, restaurantId, itemId); // ensures it exists

    const item = await this.prisma.item.update({
      where: { id: itemId },
      data: { isAvailable: dto.isAvailable },
    });

    await this.clearMenuCache(restaurantId);
    return item;
  }

  async bulkToggleAvailability(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: BulkAvailabilityDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    const result = await this.prisma.item.updateMany({
      where: { id: { in: dto.itemIds }, tenantId, restaurantId },
      data: { isAvailable: dto.isAvailable },
    });

    await this.clearMenuCache(restaurantId);
    return { updated: result.count };
  }

  async reorderItems(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: ReorderDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    await this.prisma.$transaction(
      dto.items.map(({ id, sortOrder }) =>
        this.prisma.item.updateMany({
          where: { id, tenantId, restaurantId },
          data: { sortOrder },
        }),
      ),
    );

    await this.clearMenuCache(restaurantId);
    return { message: 'Items reordered' };
  }

  // ─── M3.5 Item ↔ ModifierGroup associations ───────────────────────────────

  async attachModifierGroup(
    tenantId: string,
    restaurantId: string,
    itemId: string,
    role: UserRole,
    dto: AttachModifierGroupDto,
  ) {
    this.requireManagerRole(role);
    await this.getItem(tenantId, restaurantId, itemId); // ensures it exists

    // Verify modifier group belongs to this restaurant
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: dto.modifierGroupId, tenantId, restaurantId },
    });
    if (!group) throw new NotFoundException('Modifier group not found in this restaurant');

    // Upsert the association (idempotent)
    await this.prisma.itemModifierGroup.upsert({
      where: {
        itemId_modifierGroupId: {
          itemId,
          modifierGroupId: dto.modifierGroupId,
        },
      },
      create: {
        itemId,
        modifierGroupId: dto.modifierGroupId,
        sortOrder: dto.sortOrder ?? 0,
      },
      update: {
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.clearMenuCache(restaurantId);
    return this.getItem(tenantId, restaurantId, itemId);
  }

  async detachModifierGroup(
    tenantId: string,
    restaurantId: string,
    itemId: string,
    modifierGroupId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.getItem(tenantId, restaurantId, itemId);

    await this.prisma.itemModifierGroup.deleteMany({
      where: { itemId, modifierGroupId },
    });

    await this.clearMenuCache(restaurantId);
    return { message: 'Modifier group detached' };
  }

  // ─── M3.8 Full menu tree (public-safe read, cached) ──────────────────────

  async getFullMenu(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    const cacheKey = this.cacheKey(restaurantId);
    const cached = await this.redis.getJson(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      where: { restaurantId, tenantId, isActive: true },
      include: {
        items: {
          where: { isAvailable: true },
          include: {
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroup: {
                  include: {
                    modifiers: {
                      where: { isAvailable: true },
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        childGroups: {
                          include: {
                            modifiers: {
                              where: { isAvailable: true },
                              orderBy: { sortOrder: 'asc' },
                              include: {
                                childGroups: {
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
                    },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    await this.redis.setJson(cacheKey, categories, MENU_CACHE_TTL);
    return categories;
  }
}
