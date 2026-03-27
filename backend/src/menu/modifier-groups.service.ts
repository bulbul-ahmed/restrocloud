import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { MenuService } from './menu.service';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { UpdateModifierDto } from './dto/update-modifier.dto';
import { ReorderDto } from './dto/reorder-items.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

@Injectable()
export class ModifierGroupsService {
  private readonly logger = new Logger(ModifierGroupsService.name);

  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  private requireManagerRole(role: UserRole) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new ForbiddenException('MANAGER or higher role required');
    }
  }

  private async requireRestaurant(tenantId: string, restaurantId: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  // ─── M3.3 Modifier Groups ─────────────────────────────────────────────────

  async createGroup(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: CreateModifierGroupDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    const group = await this.prisma.modifierGroup.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        minSelect: dto.minSelect ?? 0,
        maxSelect: dto.maxSelect ?? 1,
        isRequired: dto.isRequired ?? false,
        parentModifierId: dto.parentModifierId ?? null,
        // Optionally create modifiers inline
        modifiers: dto.modifiers?.length
          ? {
              create: dto.modifiers.map((m, i) => ({
                tenantId,
                name: m.name,
                priceAdjustment: m.priceAdjustment ?? 0,
                isDefault: m.isDefault ?? false,
                isAvailable: m.isAvailable ?? true,
                isRequired: m.isRequired ?? false,
                sortOrder: m.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: {
        modifiers: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return group;
  }

  async listGroups(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.modifierGroup.findMany({
      where: { tenantId, restaurantId, parentModifierId: null },
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
        _count: { select: { itemGroups: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getGroup(tenantId: string, restaurantId: string, groupId: string) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, tenantId, restaurantId },
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
        itemGroups: {
          include: { item: { select: { id: true, name: true } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Modifier group not found');
    return group;
  }

  async updateGroup(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    role: UserRole,
    dto: UpdateModifierGroupDto,
  ) {
    this.requireManagerRole(role);
    await this.getGroup(tenantId, restaurantId, groupId);

    const group = await this.prisma.modifierGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.minSelect !== undefined && { minSelect: dto.minSelect }),
        ...(dto.maxSelect !== undefined && { maxSelect: dto.maxSelect }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
      },
      include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return group;
  }

  async deleteGroup(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.getGroup(tenantId, restaurantId, groupId);

    // ItemModifierGroup rows cascade-delete automatically (schema: onDelete: Cascade)
    await this.prisma.modifierGroup.delete({ where: { id: groupId } });
    await this.menuService.clearMenuCache(restaurantId);
  }

  // ─── M3.4 Modifiers ───────────────────────────────────────────────────────

  private async requireModifier(tenantId: string, groupId: string, modifierId: string) {
    const modifier = await this.prisma.modifier.findFirst({
      where: { id: modifierId, modifierGroupId: groupId, tenantId },
    });
    if (!modifier) throw new NotFoundException('Modifier not found');
    return modifier;
  }

  async addModifier(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    role: UserRole,
    dto: CreateModifierDto,
  ) {
    this.requireManagerRole(role);
    await this.getGroup(tenantId, restaurantId, groupId);

    const modifier = await this.prisma.modifier.create({
      data: {
        tenantId,
        modifierGroupId: groupId,
        name: dto.name,
        priceAdjustment: dto.priceAdjustment ?? 0,
        isDefault: dto.isDefault ?? false,
        isAvailable: dto.isAvailable ?? true,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return modifier;
  }

  async updateModifier(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    modifierId: string,
    role: UserRole,
    dto: UpdateModifierDto,
  ) {
    this.requireManagerRole(role);
    await this.requireModifier(tenantId, groupId, modifierId);

    const modifier = await this.prisma.modifier.update({
      where: { id: modifierId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.priceAdjustment !== undefined && { priceAdjustment: dto.priceAdjustment }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return modifier;
  }

  async deleteModifier(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    modifierId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.requireModifier(tenantId, groupId, modifierId);

    await this.prisma.modifier.delete({ where: { id: modifierId } });
    await this.menuService.clearMenuCache(restaurantId);
  }

  async reorderModifiers(
    tenantId: string,
    restaurantId: string,
    groupId: string,
    role: UserRole,
    dto: ReorderDto,
  ) {
    this.requireManagerRole(role);
    await this.getGroup(tenantId, restaurantId, groupId);

    await this.prisma.$transaction(
      dto.items.map(({ id, sortOrder }) =>
        this.prisma.modifier.updateMany({
          where: { id, modifierGroupId: groupId, tenantId },
          data: { sortOrder },
        }),
      ),
    );

    await this.menuService.clearMenuCache(restaurantId);
    return { message: 'Modifiers reordered' };
  }
}
