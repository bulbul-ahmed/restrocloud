import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { MenuService } from './menu.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { ToggleAvailabilityDto } from './dto/toggle-availability.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

@Injectable()
export class CombosService {
  private readonly logger = new Logger(CombosService.name);

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

  // ─── M3.6 Combos ─────────────────────────────────────────────────────────

  async createCombo(
    tenantId: string,
    restaurantId: string,
    role: UserRole,
    dto: CreateComboDto,
  ) {
    this.requireManagerRole(role);
    await this.requireRestaurant(tenantId, restaurantId);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A combo must include at least one item');
    }

    // Verify all item IDs belong to this restaurant
    const itemIds = dto.items.map((i) => i.itemId);
    const existingItems = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, tenantId, restaurantId },
      select: { id: true },
    });

    if (existingItems.length !== itemIds.length) {
      throw new NotFoundException('One or more items not found in this restaurant');
    }

    const combo = await this.prisma.combo.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        isAvailable: dto.isAvailable ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        items: {
          create: dto.items.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, price: true } } },
        },
      },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return combo;
  }

  async listCombos(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.combo.findMany({
      where: { tenantId, restaurantId },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, price: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCombo(tenantId: string, restaurantId: string, comboId: string) {
    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, tenantId, restaurantId },
      include: {
        items: {
          include: { item: true },
        },
      },
    });
    if (!combo) throw new NotFoundException('Combo not found');
    return combo;
  }

  async updateCombo(
    tenantId: string,
    restaurantId: string,
    comboId: string,
    role: UserRole,
    dto: UpdateComboDto,
  ) {
    this.requireManagerRole(role);
    await this.getCombo(tenantId, restaurantId, comboId);

    // If items are provided, validate and replace
    if (dto.items !== undefined) {
      if (dto.items.length === 0) {
        throw new BadRequestException('A combo must include at least one item');
      }

      const itemIds = dto.items.map((i) => i.itemId);
      const existingItems = await this.prisma.item.findMany({
        where: { id: { in: itemIds }, tenantId, restaurantId },
        select: { id: true },
      });
      if (existingItems.length !== itemIds.length) {
        throw new NotFoundException('One or more items not found in this restaurant');
      }
    }

    const combo = await this.prisma.combo.update({
      where: { id: comboId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
        // Replace combo items if provided
        ...(dto.items !== undefined && {
          items: {
            deleteMany: {},
            create: dto.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          },
        }),
      },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, price: true } } },
        },
      },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return combo;
  }

  async deleteCombo(
    tenantId: string,
    restaurantId: string,
    comboId: string,
    role: UserRole,
  ) {
    this.requireManagerRole(role);
    await this.getCombo(tenantId, restaurantId, comboId);

    await this.prisma.combo.delete({ where: { id: comboId } });
    await this.menuService.clearMenuCache(restaurantId);
  }

  async toggleComboAvailability(
    tenantId: string,
    restaurantId: string,
    comboId: string,
    role: UserRole,
    dto: ToggleAvailabilityDto,
  ) {
    this.requireManagerRole(role);
    await this.getCombo(tenantId, restaurantId, comboId);

    const combo = await this.prisma.combo.update({
      where: { id: comboId },
      data: { isAvailable: dto.isAvailable },
    });

    await this.menuService.clearMenuCache(restaurantId);
    return combo;
  }
}
